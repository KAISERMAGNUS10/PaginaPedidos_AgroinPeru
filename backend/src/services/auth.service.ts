import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

import { AuthPayload, RegistroDto, UsuarioSesion } from '../models/auth.model';
import { UsuarioRepository, UsuarioRow } from '../repositories/usuario.repository';
import { badRequest, conflicto, noAutorizado } from '../utils/errores';
import {
  normalizarTipoDocumento,
  pick,
  texto,
  validarCelular,
  validarEmail,
  validarNumeroDocumento,
  validarPasswordNueva
} from '../utils/validadores';

const repo = new UsuarioRepository();

export function aUsuarioSesion(u: UsuarioRow): UsuarioSesion {
  return {
    id: u.id_usuario,
    Nombre: u.nombres,
    Apellidos: u.apellidos,
    Correo: u.email,
    Rol: u.nombre_rol,
    Telefono: u.telefono,
    DocumentoTipo: u.tipo_documento,
    DocumentoNumero: u.numero_documento
  };
}

export class AuthService {
  private generarToken(u: UsuarioRow): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET no configurado');

    const payload: AuthPayload = { id: u.id_usuario, rol: u.nombre_rol, email: u.email };

    return jwt.sign(payload, secret, {
      expiresIn: (process.env.JWT_EXPIRES_IN ?? '2h') as jwt.SignOptions['expiresIn']
    });
  }

  async login(body: any) {
    const email = validarEmail(pick(body, 'email', 'correo'));
    const password = pick(body, 'password', 'pass');

    if (typeof password !== 'string' || !password) {
      throw badRequest('PASSWORD_OBLIGATORIO', 'La contraseña es obligatoria.');
    }

    const usuario = await repo.porEmail(email);

    // Mismo mensaje para correo inexistente o clave incorrecta (no revela cuál falló).
    if (!usuario || !(await bcrypt.compare(password, usuario.password_hash))) {
      throw noAutorizado('CREDENCIALES_INVALIDAS', 'Correo o contraseña incorrectos.');
    }

    if (usuario.estado !== 'ACTIVO') {
      throw noAutorizado('CUENTA_NO_DISPONIBLE', 'Tu cuenta no está disponible. Contacta a la tienda.');
    }

    await repo.registrarAcceso(usuario.id_usuario);

    return { token: this.generarToken(usuario), usuario: aUsuarioSesion(usuario) };
  }

  async registrarCliente(body: RegistroDto) {
    const nombres = texto(body?.nombre);
    const apellidos = texto(body?.apellidos);

    if (nombres.length < 2) throw badRequest('NOMBRE_INVALIDO', 'Ingresa tu nombre.');
    if (apellidos.length < 2) throw badRequest('APELLIDOS_INVALIDOS', 'Ingresa tus apellidos.');

    const email = validarEmail(pick(body, 'correo', 'email'));
    const password = validarPasswordNueva(pick(body, 'password', 'pass'));
    const tipoDoc = normalizarTipoDocumento(pick(body, 'documentoTipo') ?? 'DNI');

    if (tipoDoc === 'RUC') {
      throw badRequest('TIPO_DOCUMENTO_INVALIDO', 'Para registrarte usa DNI o Carné de Extranjería.');
    }

    const numeroDoc = validarNumeroDocumento(tipoDoc, pick(body, 'documentoNumero'));
    const celular = validarCelular(pick(body, 'celular', 'telefono'));

    if (await repo.porEmail(email)) {
      throw conflicto('EMAIL_YA_REGISTRADO', 'Este correo ya está registrado.');
    }
    if (await repo.porDocumento(numeroDoc)) {
      throw conflicto('DOCUMENTO_YA_REGISTRADO', 'Este documento ya está registrado.');
    }

    const idRol = await repo.idRol('CLIENTE');
    if (!idRol) throw new Error('El rol CLIENTE no existe en la base de datos');

    const id = await repo.crear({
      id_rol: idRol,
      nombres,
      apellidos,
      tipo_documento: tipoDoc,
      numero_documento: numeroDoc,
      email,
      password_hash: await bcrypt.hash(password, 12),
      telefono: celular
    });

    const usuario = (await repo.porId(id))!;

    // El frontend inicia sesión automáticamente después de registrarse.
    return { token: this.generarToken(usuario), usuario: aUsuarioSesion(usuario) };
  }

  async perfil(idUsuario: number): Promise<UsuarioSesion> {
    const usuario = await repo.porId(idUsuario);

    if (!usuario || usuario.estado !== 'ACTIVO') {
      throw noAutorizado('CUENTA_NO_DISPONIBLE', 'Tu sesión ya no es válida.');
    }

    return aUsuarioSesion(usuario);
  }
}

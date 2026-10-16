import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

import { PG_VALOR_DUPLICADO } from '../config/database';
import { AuthPayload, RegistroDto, UsuarioSesion } from '../models/auth.model';
import { SoporteRepository } from '../repositories/soporte.repository';
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
const repoSoporte = new SoporteRepository();

export function aUsuarioSesion(u: UsuarioRow): UsuarioSesion {
  return {
    id: u.id_usuario,
    Nombre: u.nombres,
    Apellidos: u.apellidos,
    Correo: u.email,
    Rol: u.nombre_rol,
    Telefono: u.telefono,
    DocumentoTipo: u.tipo_documento,
    DocumentoNumero: u.numero_documento,
    DebeCambiarPassword: Boolean(u.debe_cambiar_password)
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

  /** El usuario cambia su propia contraseña (también la temporal que le puso soporte). */
  async cambiarPassword(idUsuario: number, body: any): Promise<UsuarioSesion> {
    const actual = pick(body, 'actual', 'passwordActual');
    if (typeof actual !== 'string' || !actual) {
      throw badRequest('PASSWORD_ACTUAL_OBLIGATORIA', 'Ingresa tu contraseña actual.');
    }
    const nueva = validarPasswordNueva(pick(body, 'nueva', 'passwordNueva'));
    if (nueva === actual) {
      throw badRequest('PASSWORD_REPETIDA', 'La nueva contraseña debe ser distinta de la actual.');
    }

    const usuario = await repo.porId(idUsuario);
    if (!usuario || usuario.estado !== 'ACTIVO') {
      throw noAutorizado('CUENTA_NO_DISPONIBLE', 'Tu sesión ya no es válida.');
    }
    if (!(await bcrypt.compare(actual, usuario.password_hash))) {
      throw badRequest('PASSWORD_ACTUAL_INCORRECTA', 'La contraseña actual no es correcta.');
    }

    await repo.cambiarPassword(idUsuario, await bcrypt.hash(nueva, 12), false);
    return aUsuarioSesion((await repo.porId(idUsuario))!);
  }

  /**
   * "¿Olvidaste tu contraseña?": deja una solicitud para que soporte la atienda.
   * Solo se registra si el correo y el documento son de la misma cuenta, y la respuesta
   * es siempre la misma para no revelar qué correos existen.
   */
  async solicitarRecuperacion(body: any) {
    const email = validarEmail(pick(body, 'correo', 'email'));
    const documento = texto(pick(body, 'documentoNumero', 'documento'));
    if (!documento) throw badRequest('DOCUMENTO_OBLIGATORIO', 'Ingresa tu número de documento.');

    const usuario = await repo.porEmail(email);

    if (usuario && usuario.numero_documento === documento && !(await repoSoporte.tienePendiente(usuario.id_usuario))) {
      try {
        await repoSoporte.crear(usuario.id_usuario);
      } catch (error: any) {
        // Dos clics seguidos: el índice único ya dejó una solicitud pendiente.
        if (error?.code !== PG_VALOR_DUPLICADO) throw error;
      }
    }

    return { recibida: true };
  }
}

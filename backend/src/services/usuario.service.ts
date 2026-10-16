import bcrypt from 'bcrypt';

import { RolUsuario } from '../models/auth.model';
import { UsuarioRepository } from '../repositories/usuario.repository';
import { badRequest, conflicto, noEncontrado } from '../utils/errores';
import {
  normalizarTipoDocumento,
  pick,
  texto,
  validarCelular,
  validarEmail,
  validarNumeroDocumento,
  validarPasswordNueva
} from '../utils/validadores';
import { aUsuarioSesion } from './auth.service';

const repo = new UsuarioRepository();

export class UsuarioService {
  async listar(rol?: string) {
    const filas = await repo.listar(rol ? rol.toUpperCase() : undefined);
    return filas.map(u => ({
      ...aUsuarioSesion(u),
      estado: u.estado,
      fechaRegistro: u.fecha_registro,
      ultimoAcceso: u.ultimo_acceso
    }));
  }

  /** El ADMIN crea cuentas (ADMIN / CAJA / PICKING / CLIENTE). */
  async crearPersonal(body: any) {
    const rol = texto(body?.rol).toUpperCase() as RolUsuario;

    if (!['ADMIN', 'CAJA', 'PICKING', 'CLIENTE'].includes(rol)) {
      throw badRequest('ROL_INVALIDO', 'Rol permitido: ADMIN, CAJA, PICKING o CLIENTE.');
    }

    const nombres = texto(body?.nombre);
    const apellidos = texto(body?.apellidos);
    if (nombres.length < 2 || apellidos.length < 2) {
      throw badRequest('NOMBRE_INVALIDO', 'Ingresa nombres y apellidos.');
    }

    const email = validarEmail(pick(body, 'correo', 'email'));
    const password = validarPasswordNueva(pick(body, 'password', 'pass'));
    const tipoDoc = normalizarTipoDocumento(pick(body, 'documentoTipo') ?? 'DNI');
    const numeroDoc = validarNumeroDocumento(tipoDoc, pick(body, 'documentoNumero'));
    const celular = validarCelular(pick(body, 'celular', 'telefono'));

    if (await repo.porEmail(email)) throw conflicto('EMAIL_YA_REGISTRADO', 'Ese correo ya existe.');
    if (await repo.porDocumento(numeroDoc)) {
      throw conflicto('DOCUMENTO_YA_REGISTRADO', 'Ese documento ya existe.');
    }

    const idRol = await repo.idRol(rol);
    if (!idRol) throw new Error(`El rol ${rol} no existe`);

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

    return aUsuarioSesion((await repo.porId(id))!);
  }

  async cambiarEstado(id: number, estado: string, idAdmin: number) {
    const nuevo = texto(estado).toUpperCase();

    if (!['ACTIVO', 'INACTIVO', 'BLOQUEADO'].includes(nuevo)) {
      throw badRequest('ESTADO_INVALIDO', 'Estado: ACTIVO, INACTIVO o BLOQUEADO.');
    }
    if (id === idAdmin) {
      throw badRequest('AUTO_BLOQUEO', 'No puedes cambiar el estado de tu propia cuenta.');
    }

    const usuario = await repo.porId(id);
    if (!usuario) throw noEncontrado('USUARIO_NO_ENCONTRADO', 'El usuario no existe.');

    await repo.cambiarEstado(id, nuevo);
    return { id, estado: nuevo };
  }

  /** Edita nombre, apellidos, celular, rol, estado y (opcional) restablece la contraseña. */
  async actualizar(id: number, body: any, idAdmin: number) {
    const usuario = await repo.porId(id);
    if (!usuario) throw noEncontrado('USUARIO_NO_ENCONTRADO', 'El usuario no existe.');

    const campos: Record<string, string | number | null> = {};

    if (body?.nombre !== undefined) {
      const v = texto(body.nombre);
      if (v.length < 2) throw badRequest('NOMBRE_INVALIDO', 'Ingresa el nombre.');
      campos.nombres = v;
    }
    if (body?.apellidos !== undefined) {
      const v = texto(body.apellidos);
      if (v.length < 2) throw badRequest('APELLIDOS_INVALIDOS', 'Ingresa los apellidos.');
      campos.apellidos = v;
    }
    if (body?.celular !== undefined || body?.telefono !== undefined) {
      campos.telefono = validarCelular(pick(body, 'celular', 'telefono'));
    }
    if (body?.correo !== undefined || body?.email !== undefined) {
      const email = validarEmail(pick(body, 'correo', 'email'));
      const otro = await repo.porEmail(email);
      if (otro && otro.id_usuario !== id) throw conflicto('EMAIL_YA_REGISTRADO', 'Ese correo ya está en uso.');
      campos.email = email;
    }
    if (body?.rol !== undefined) {
      const rol = texto(body.rol).toUpperCase() as RolUsuario;
      if (!['ADMIN', 'CAJA', 'PICKING', 'CLIENTE'].includes(rol)) throw badRequest('ROL_INVALIDO', 'Rol no válido.');
      if (id === idAdmin && rol !== 'ADMIN') throw badRequest('AUTO_ROL', 'No puedes quitarte el rol de administrador.');
      const idRol = await repo.idRol(rol);
      if (!idRol) throw new Error(`El rol ${rol} no existe`);
      campos.id_rol = idRol;
    }
    if (body?.estado !== undefined) {
      const estado = texto(body.estado).toUpperCase();
      if (!['ACTIVO', 'INACTIVO', 'BLOQUEADO'].includes(estado)) throw badRequest('ESTADO_INVALIDO', 'Estado no válido.');
      if (id === idAdmin && estado !== 'ACTIVO') throw badRequest('AUTO_BLOQUEO', 'No puedes desactivar tu propia cuenta.');
      campos.estado = estado;
    }
    if (body?.password) {
      campos.password_hash = await bcrypt.hash(validarPasswordNueva(body.password), 12);
    }

    await repo.actualizar(id, campos);
    return aUsuarioSesion((await repo.porId(id))!);
  }
}

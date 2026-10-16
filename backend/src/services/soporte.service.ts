import bcrypt from 'bcrypt';

import { Conexion, conTransaccion } from '../config/database';
import { EstadoSolicitud, SoporteRepository, SolicitudRow } from '../repositories/soporte.repository';
import { UsuarioRepository } from '../repositories/usuario.repository';
import { conflicto, noEncontrado } from '../utils/errores';
import { aIso } from '../utils/fechas';
import { texto } from '../utils/validadores';

/** Contraseña temporal que asigna soporte. El usuario debe cambiarla al iniciar sesión. */
export const PASSWORD_TEMPORAL = '12345678';

const repo = new SoporteRepository();
const repoUsuario = new UsuarioRepository();

function aDto(s: SolicitudRow) {
  return {
    id: s.id_solicitud,
    estado: s.estado,
    fechaSolicitud: aIso(s.fecha_solicitud),
    fechaAtencion: aIso(s.fecha_atencion),
    observacion: s.observacion ?? '',
    atendidoPor: s.soporte ?? '',
    usuario: {
      id: s.id_usuario,
      nombre: `${s.nombres} ${s.apellidos}`.trim(),
      correo: s.email,
      documentoTipo: s.tipo_documento,
      documentoNumero: s.numero_documento,
      telefono: s.telefono,
      rol: s.nombre_rol,
      estado: s.estado_usuario
    }
  };
}

export class SoporteService {
  async listar(estado?: string) {
    const e = texto(estado).toUpperCase();
    const filtro = ['PENDIENTE', 'ATENDIDA', 'RECHAZADA'].includes(e) ? (e as EstadoSolicitud) : undefined;
    return (await repo.listar(filtro)).map(aDto);
  }

  /** Pone la contraseña temporal 12345678 y obliga al usuario a cambiarla al entrar. */
  async restablecer(idSoporte: number, idSolicitud: number) {
    const hash = await bcrypt.hash(PASSWORD_TEMPORAL, 12);

    await conTransaccion(async conexion => {
      const solicitud = await this.pendiente(conexion, idSolicitud);
      await repoUsuario.cambiarPassword(solicitud.id_usuario, hash, true, conexion);
      await repo.cerrar(conexion, idSolicitud, 'ATENDIDA', idSoporte, `Contraseña temporal ${PASSWORD_TEMPORAL} asignada`);
    });

    return { passwordTemporal: PASSWORD_TEMPORAL };
  }

  /** Soporte no pudo verificar la identidad del usuario. */
  async rechazar(idSoporte: number, idSolicitud: number, body: any) {
    const motivo = texto(body?.motivo ?? body?.observacion).slice(0, 255) || 'No se pudo verificar la identidad';

    await conTransaccion(async conexion => {
      await this.pendiente(conexion, idSolicitud);
      await repo.cerrar(conexion, idSolicitud, 'RECHAZADA', idSoporte, motivo);
    });

    return { rechazada: true };
  }

  private async pendiente(conexion: Conexion, id: number) {
    const solicitud = await repo.bloquearPorId(conexion, id);
    if (!solicitud) throw noEncontrado('SOLICITUD_NO_ENCONTRADA', 'No se encontró la solicitud.');
    if (solicitud.estado !== 'PENDIENTE') {
      throw conflicto('SOLICITUD_YA_ATENDIDA', 'Esta solicitud ya fue atendida.');
    }
    return solicitud;
  }
}

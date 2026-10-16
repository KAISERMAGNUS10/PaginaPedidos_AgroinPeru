import { Conexion, Fila, pool } from '../config/database';

export type EstadoSolicitud = 'PENDIENTE' | 'ATENDIDA' | 'RECHAZADA';

export interface SolicitudRow extends Fila {
  id_solicitud: number;
  id_usuario: number;
  estado: EstadoSolicitud;
  fecha_solicitud: Date;
  fecha_atencion: Date | null;
  observacion: string | null;
  nombres: string;
  apellidos: string;
  email: string;
  tipo_documento: string;
  numero_documento: string;
  telefono: string;
  nombre_rol: string;
  estado_usuario: string;
  soporte: string | null;
}

const SELECT_SOLICITUD = `
  SELECT s.id_solicitud, s.id_usuario, s.estado, s.fecha_solicitud, s.fecha_atencion, s.observacion,
         u.nombres, u.apellidos, u.email, u.tipo_documento, u.numero_documento, u.telefono,
         r.nombre_rol, u.estado AS estado_usuario,
         CONCAT(sp.nombres, ' ', sp.apellidos) AS soporte
    FROM tbl_solicitudes_recuperacion s
    JOIN tbl_usuarios u ON u.id_usuario = s.id_usuario
    JOIN tbl_roles r ON r.id_rol = u.id_rol
    LEFT JOIN tbl_usuarios sp ON sp.id_usuario = s.id_soporte
`;

export class SoporteRepository {
  async crear(idUsuario: number): Promise<void> {
    await pool.execute(
      "INSERT INTO tbl_solicitudes_recuperacion (id_usuario, estado) VALUES (?, 'PENDIENTE')",
      [idUsuario]
    );
  }

  async tienePendiente(idUsuario: number): Promise<boolean> {
    const [rows] = await pool.query<Fila[]>(
      "SELECT 1 FROM tbl_solicitudes_recuperacion WHERE id_usuario = ? AND estado = 'PENDIENTE' LIMIT 1",
      [idUsuario]
    );
    return rows.length > 0;
  }

  async listar(estado?: EstadoSolicitud): Promise<SolicitudRow[]> {
    const [rows] = await pool.query<SolicitudRow[]>(
      `${SELECT_SOLICITUD}
       ${estado ? 'WHERE s.estado = ?' : ''}
       ORDER BY s.fecha_solicitud ${estado === 'PENDIENTE' ? 'ASC' : 'DESC'}
       LIMIT 200`,
      estado ? [estado] : []
    );
    return rows;
  }

  async bloquearPorId(conexion: Conexion, id: number): Promise<SolicitudRow | null> {
    const [rows] = await conexion.query<SolicitudRow[]>(
      `${SELECT_SOLICITUD} WHERE s.id_solicitud = ? FOR UPDATE OF s`,
      [id]
    );
    return rows[0] ?? null;
  }

  async cerrar(
    conexion: Conexion,
    id: number,
    estado: 'ATENDIDA' | 'RECHAZADA',
    idSoporte: number,
    observacion: string | null
  ): Promise<void> {
    await conexion.execute(
      `UPDATE tbl_solicitudes_recuperacion
          SET estado = ?, id_soporte = ?, observacion = ?, fecha_atencion = NOW()
        WHERE id_solicitud = ?`,
      [estado, idSoporte, observacion, id]
    );
  }
}

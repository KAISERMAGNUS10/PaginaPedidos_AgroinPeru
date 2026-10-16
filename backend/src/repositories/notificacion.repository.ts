import { Conexion, Fila, pool, ResultadoEscritura } from '../config/database';

export interface NotificacionRow extends Fila {
  id_notificacion: number;
  id_pedido: number | null;
  codigo_ticket: string | null;
  titulo: string;
  mensaje: string;
  tipo: string;
  leido: number;
  mostrado_toast: number;
  fecha_envio: Date;
}

export class NotificacionRepository {
  async crear(
    datos: {
      id_usuario: number;
      id_pedido?: number | null;
      titulo: string;
      mensaje: string;
      tipo?: 'INFO' | 'EXITO' | 'ALERTA' | 'URGENTE';
    },
    conexion?: Conexion
  ): Promise<void> {
    await (conexion ?? pool).execute(
      `INSERT INTO tbl_notificaciones (id_usuario, id_pedido, titulo, mensaje, tipo)
       VALUES (?, ?, ?, ?, ?)`,
      [datos.id_usuario, datos.id_pedido ?? null, datos.titulo, datos.mensaje, datos.tipo ?? 'INFO']
    );
  }

  async deUsuario(idUsuario: number, limite = 50): Promise<NotificacionRow[]> {
    const [rows] = await pool.query<NotificacionRow[]>(
      `SELECT n.id_notificacion, n.id_pedido, p.codigo_ticket, n.titulo, n.mensaje,
              n.tipo, n.leido, n.mostrado_toast, n.fecha_envio
         FROM tbl_notificaciones n
         LEFT JOIN tbl_pedidos p ON p.id_pedido = n.id_pedido
        WHERE n.id_usuario = ?
        ORDER BY n.fecha_envio DESC, n.id_notificacion DESC
        LIMIT ?`,
      [idUsuario, limite]
    );
    return rows;
  }

  async marcarLeidas(idUsuario: number, id?: number): Promise<number> {
    const [res] = await pool.execute<ResultadoEscritura>(
      `UPDATE tbl_notificaciones SET leido = 1, mostrado_toast = 1
        WHERE id_usuario = ? ${id ? 'AND id_notificacion = ?' : ''}`,
      id ? [idUsuario, id] : [idUsuario]
    );
    return res.affectedRows;
  }

  async marcarToastMostrado(idUsuario: number): Promise<void> {
    await pool.execute(
      'UPDATE tbl_notificaciones SET mostrado_toast = 1 WHERE id_usuario = ? AND mostrado_toast = 0',
      [idUsuario]
    );
  }
}

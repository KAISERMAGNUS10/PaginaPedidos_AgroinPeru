import { PoolConnection, RowDataPacket } from 'mysql2/promise';

import { pool } from '../config/database';

export interface TiendaRow extends RowDataPacket {
  id_tienda: number;
  codigo_tienda: string;
  nombre_tienda: string;
  direccion: string;
  distrito: string;
  ciudad: string;
  departamento: string;
  telefono_contacto: string | null;
  horario_atencion: string | null;
  tiempo_promedio_preparacion: string | null;
  estado: string;
}

export class TiendaRepository {
  async activas(): Promise<TiendaRow[]> {
    const [rows] = await pool.query<TiendaRow[]>(
      "SELECT * FROM tbl_tiendas_recojo WHERE estado = 'ACTIVA' ORDER BY id_tienda"
    );
    return rows;
  }

  async activaPorId(conexion: PoolConnection, id?: number): Promise<TiendaRow | null> {
    const [rows] = await conexion.query<TiendaRow[]>(
      `SELECT * FROM tbl_tiendas_recojo
        WHERE estado = 'ACTIVA' ${id ? 'AND id_tienda = ?' : ''}
        ORDER BY id_tienda LIMIT 1`,
      id ? [id] : []
    );
    return rows[0] ?? null;
  }
}

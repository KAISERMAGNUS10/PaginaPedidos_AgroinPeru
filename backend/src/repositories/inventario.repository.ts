import { PoolConnection, RowDataPacket } from 'mysql2/promise';

import { pool } from '../config/database';

export type Ubicacion = 'TIENDA' | 'ALMACEN';
export type TipoMovimiento = 'ENTRADA' | 'SALIDA' | 'AJUSTE' | 'TRASLADO';

export interface MovimientoNuevo {
  id_producto: number;
  id_usuario: number;
  id_pedido?: number | null;
  tipo_movimiento: TipoMovimiento;
  ubicacion_origen?: Ubicacion | null;
  ubicacion_destino?: Ubicacion | null;
  cantidad: number;
  stock_anterior: number;
  stock_posterior: number;
  motivo?: string | null;
}

export interface MovimientoRow extends RowDataPacket {
  id_movimiento: number;
  codigo_sku: string;
  nombre_completo: string;
  usuario: string;
  id_pedido: number | null;
  codigo_ticket: string | null;
  tipo_movimiento: TipoMovimiento;
  ubicacion_origen: Ubicacion | null;
  ubicacion_destino: Ubicacion | null;
  cantidad: number;
  stock_anterior: number;
  stock_posterior: number;
  motivo: string | null;
  fecha_movimiento: Date;
}

export class InventarioRepository {
  async registrarMovimiento(conexion: PoolConnection, m: MovimientoNuevo): Promise<void> {
    await conexion.execute(
      `INSERT INTO tbl_movimientos_inventario
         (id_producto, id_usuario, id_pedido, tipo_movimiento,
          ubicacion_origen, ubicacion_destino, cantidad,
          stock_anterior, stock_posterior, motivo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        m.id_producto,
        m.id_usuario,
        m.id_pedido ?? null,
        m.tipo_movimiento,
        m.ubicacion_origen ?? null,
        m.ubicacion_destino ?? null,
        m.cantidad,
        m.stock_anterior,
        m.stock_posterior,
        m.motivo ?? null
      ]
    );
  }

  /** Salidas registradas por un pedido (para devolver el stock al cancelar / expirar). */
  async salidasDePedido(
    conexion: PoolConnection,
    idPedido: number
  ): Promise<Array<{ id_producto: number; ubicacion: Ubicacion; cantidad: number }>> {
    const [rows] = await conexion.query<RowDataPacket[]>(
      `SELECT id_producto, ubicacion_origen AS ubicacion, SUM(cantidad) AS cantidad
         FROM tbl_movimientos_inventario
        WHERE id_pedido = ? AND tipo_movimiento = 'SALIDA'
        GROUP BY id_producto, ubicacion_origen`,
      [idPedido]
    );
    return rows.map(r => ({
      id_producto: Number(r.id_producto),
      ubicacion: r.ubicacion as Ubicacion,
      cantidad: Number(r.cantidad)
    }));
  }

  async listarMovimientos(filtros: {
    sku?: string;
    tipo?: string;
    limite: number;
  }): Promise<MovimientoRow[]> {
    const where: string[] = [];
    const params: unknown[] = [];

    if (filtros.sku) {
      where.push('p.codigo_sku = ?');
      params.push(filtros.sku);
    }
    if (filtros.tipo) {
      where.push('m.tipo_movimiento = ?');
      params.push(filtros.tipo);
    }

    const [rows] = await pool.query<MovimientoRow[]>(
      `SELECT m.id_movimiento, p.codigo_sku, p.nombre_completo,
              CONCAT(u.nombres, ' ', u.apellidos) AS usuario,
              m.id_pedido, pe.codigo_ticket,
              m.tipo_movimiento, m.ubicacion_origen, m.ubicacion_destino,
              m.cantidad, m.stock_anterior, m.stock_posterior,
              m.motivo, m.fecha_movimiento
         FROM tbl_movimientos_inventario m
         JOIN tbl_productos p ON p.id_producto = m.id_producto
         JOIN tbl_usuarios u ON u.id_usuario = m.id_usuario
         LEFT JOIN tbl_pedidos pe ON pe.id_pedido = m.id_pedido
        ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
        ORDER BY m.id_movimiento DESC
        LIMIT ?`,
      [...params, filtros.limite]
    );
    return rows;
  }
}

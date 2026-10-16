import { Conexion, Fila, pool } from '../config/database';
import { ZONA_HORARIA } from '../utils/fechas';

export class DashboardRepository {
  /** Ventas (S/) por día calendario de Perú, entre dos instantes. */
  async ventasPorDia(desde: Date, hasta: Date): Promise<Array<{ dia: string; total: number }>> {
    const [rows] = await pool.query<Fila[]>(
      `SELECT TO_CHAR(fecha_pago AT TIME ZONE ?, 'YYYY-MM-DD') AS dia,
              SUM(monto_total) AS total
         FROM tbl_pagos
        WHERE estado = 'COMPLETADO' AND fecha_pago BETWEEN ? AND ?
        GROUP BY dia`,
      [ZONA_HORARIA, desde, hasta]
    );
    return rows.map(r => ({ dia: r.dia as string, total: Number(r.total) }));
  }

  /** Borra los datos operativos de la demostración (pedidos, pagos, carritos, kardex de pedidos...). */
  async reiniciarDatosOperativos(conexion: Conexion): Promise<void> {
    // 1) Devuelve al stock lo que consumieron los pedidos (neto de entradas por cancelación).
    await conexion.query(
      `UPDATE tbl_productos p
            SET stock_almacen = p.stock_almacen + m.neto_almacen,
                stock_tienda  = p.stock_tienda  + m.neto_tienda
           FROM (
           SELECT id_producto,
                  SUM(CASE WHEN tipo_movimiento = 'SALIDA'  AND ubicacion_origen  = 'ALMACEN' THEN cantidad
                           WHEN tipo_movimiento = 'ENTRADA' AND ubicacion_destino = 'ALMACEN' THEN -cantidad
                           ELSE 0 END) AS neto_almacen,
                  SUM(CASE WHEN tipo_movimiento = 'SALIDA'  AND ubicacion_origen  = 'TIENDA' THEN cantidad
                           WHEN tipo_movimiento = 'ENTRADA' AND ubicacion_destino = 'TIENDA' THEN -cantidad
                           ELSE 0 END) AS neto_tienda
             FROM tbl_movimientos_inventario
            WHERE id_pedido IS NOT NULL
            GROUP BY id_producto
         ) m
          WHERE m.id_producto = p.id_producto`
    );

    await conexion.query('DELETE FROM tbl_movimientos_inventario WHERE id_pedido IS NOT NULL');
    await conexion.query('DELETE FROM tbl_notificaciones');
    await conexion.query('DELETE FROM tbl_detalle_carrito');
    await conexion.query('DELETE FROM tbl_carrito');
    await conexion.query('DELETE FROM tbl_picking_almacen');
    await conexion.query('DELETE FROM tbl_pagos');
    await conexion.query('DELETE FROM tbl_detalle_pedidos');
    await conexion.query('DELETE FROM tbl_pedidos');
  }
}

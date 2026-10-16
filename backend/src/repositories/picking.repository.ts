import { PoolConnection } from 'mysql2/promise';

import { pool } from '../config/database';

export class PickingRepository {
  async actualizarProgreso(idPedido: number, idAlmacenero: number, items: number): Promise<void> {
    await pool.execute(
      `UPDATE tbl_picking_almacen
          SET id_almacenero = ?,
              items_separados = LEAST(?, total_items),
              estado_picking = 'EN_SEPARACION',
              fecha_inicio = COALESCE(fecha_inicio, UTC_TIMESTAMP())
        WHERE id_pedido = ? AND estado_picking IN ('PENDIENTE', 'EN_SEPARACION')`,
      [idAlmacenero, items, idPedido]
    );
  }

  async marcarListo(conexion: PoolConnection, idPedido: number, idAlmacenero: number): Promise<void> {
    await conexion.execute(
      `UPDATE tbl_picking_almacen
          SET id_almacenero = ?,
              items_separados = total_items,
              estado_picking = 'LISTO_PARA_RECOJO',
              fecha_inicio = COALESCE(fecha_inicio, UTC_TIMESTAMP()),
              fecha_listo = UTC_TIMESTAMP()
        WHERE id_pedido = ?`,
      [idAlmacenero, idPedido]
    );
  }

  async marcarEntregado(
    conexion: PoolConnection,
    idPedido: number,
    idAlmacenero: number,
    persona: { nombre: string; dni: string | null }
  ): Promise<void> {
    await conexion.execute(
      `UPDATE tbl_picking_almacen
          SET id_almacenero = COALESCE(id_almacenero, ?),
              estado_picking = 'ENTREGADO',
              fecha_entrega = UTC_TIMESTAMP(),
              persona_recoge = ?,
              dni_recoge = ?
        WHERE id_pedido = ?`,
      [idAlmacenero, persona.nombre, persona.dni, idPedido]
    );
  }
}

import { Conexion, pool } from '../config/database';

export class PickingRepository {
  async actualizarProgreso(idPedido: number, idAlmacenero: number, items: number): Promise<void> {
    await pool.execute(
      `UPDATE tbl_picking_almacen
          SET id_almacenero = ?,
              items_separados = LEAST(?::int, total_items),
              estado_picking = 'EN_SEPARACION',
              fecha_inicio = COALESCE(fecha_inicio, NOW())
        WHERE id_pedido = ? AND estado_picking IN ('PENDIENTE', 'EN_SEPARACION')`,
      [idAlmacenero, items, idPedido]
    );
  }

  async marcarListo(conexion: Conexion, idPedido: number, idAlmacenero: number): Promise<void> {
    await conexion.execute(
      `UPDATE tbl_picking_almacen
          SET id_almacenero = ?,
              items_separados = total_items,
              estado_picking = 'LISTO_PARA_RECOJO',
              fecha_inicio = COALESCE(fecha_inicio, NOW()),
              fecha_listo = NOW()
        WHERE id_pedido = ?`,
      [idAlmacenero, idPedido]
    );
  }

  async marcarEntregado(
    conexion: Conexion,
    idPedido: number,
    idAlmacenero: number,
    persona: { nombre: string; dni: string | null }
  ): Promise<void> {
    await conexion.execute(
      `UPDATE tbl_picking_almacen
          SET id_almacenero = COALESCE(id_almacenero, ?),
              estado_picking = 'ENTREGADO',
              fecha_entrega = NOW(),
              persona_recoge = ?,
              dni_recoge = ?
        WHERE id_pedido = ?`,
      [idAlmacenero, persona.nombre, persona.dni, idPedido]
    );
  }
}

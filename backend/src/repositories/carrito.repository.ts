import { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

import { pool } from '../config/database';

export interface ItemCarritoRow extends RowDataPacket {
  id_detalle_carrito: number;
  id_producto: number;
  codigo_sku: string;
  nombre_completo: string;
  nombre_categoria: string;
  subcategoria: string | null;
  medida: string | null;
  cantidad_caja: number | null;
  cantidad_bolsa: number | null;
  imagen_url: string | null;
  precio: number;
  cantidad: number;
  stock: number;
}

export class CarritoRepository {
  async obtenerOCrearActivo(idUsuario: number): Promise<number> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id_carrito FROM tbl_carrito
        WHERE id_usuario = ? AND estado = 'ACTIVO'
        ORDER BY id_carrito DESC LIMIT 1`,
      [idUsuario]
    );

    if (rows[0]) return Number(rows[0].id_carrito);

    const [res] = await pool.execute<ResultSetHeader>(
      "INSERT INTO tbl_carrito (id_usuario, estado) VALUES (?, 'ACTIVO')",
      [idUsuario]
    );
    return res.insertId;
  }

  async carritoActivoId(idUsuario: number): Promise<number | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id_carrito FROM tbl_carrito
        WHERE id_usuario = ? AND estado = 'ACTIVO'
        ORDER BY id_carrito DESC LIMIT 1`,
      [idUsuario]
    );
    return rows[0] ? Number(rows[0].id_carrito) : null;
  }

  async items(idCarrito: number): Promise<ItemCarritoRow[]> {
    const [rows] = await pool.query<ItemCarritoRow[]>(
      `SELECT d.id_detalle_carrito, d.id_producto, p.codigo_sku, p.nombre_completo,
              c.nombre_categoria, p.subcategoria, p.medida,
              p.cantidad_caja, p.cantidad_bolsa, p.imagen_url,
              p.precio, d.cantidad,
              (p.stock_tienda + p.stock_almacen) AS stock
         FROM tbl_detalle_carrito d
         JOIN tbl_productos p ON p.id_producto = d.id_producto
         JOIN tbl_categorias c ON c.id_categoria = p.id_categoria
        WHERE d.id_carrito = ?
        ORDER BY d.id_detalle_carrito ASC`,
      [idCarrito]
    );
    return rows;
  }

  async fijarCantidad(
    idCarrito: number,
    idProducto: number,
    cantidad: number,
    precio: number
  ): Promise<void> {
    await pool.execute(
      `INSERT INTO tbl_detalle_carrito (id_carrito, id_producto, cantidad, precio_unitario)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE cantidad = VALUES(cantidad), precio_unitario = VALUES(precio_unitario)`,
      [idCarrito, idProducto, cantidad, precio]
    );
  }

  async cantidadActual(idCarrito: number, idProducto: number): Promise<number> {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT cantidad FROM tbl_detalle_carrito WHERE id_carrito = ? AND id_producto = ?',
      [idCarrito, idProducto]
    );
    return rows[0] ? Number(rows[0].cantidad) : 0;
  }

  async quitar(idCarrito: number, idProducto: number): Promise<number> {
    const [res] = await pool.execute<ResultSetHeader>(
      'DELETE FROM tbl_detalle_carrito WHERE id_carrito = ? AND id_producto = ?',
      [idCarrito, idProducto]
    );
    return res.affectedRows;
  }

  async vaciar(idCarrito: number): Promise<void> {
    await pool.execute('DELETE FROM tbl_detalle_carrito WHERE id_carrito = ?', [idCarrito]);
  }

  async marcarConvertido(
    conexion: PoolConnection,
    idCarrito: number,
    idPedido: number
  ): Promise<void> {
    await conexion.execute(
      "UPDATE tbl_carrito SET estado = 'CONVERTIDO', id_pedido = ? WHERE id_carrito = ?",
      [idPedido, idCarrito]
    );
  }
}

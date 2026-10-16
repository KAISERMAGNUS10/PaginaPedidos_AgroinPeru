import { RowDataPacket } from 'mysql2/promise';

import { pool } from '../config/database';
import { offsetZona } from '../utils/fechas';

type Rango = [Date, Date];

const dia = (campo: string) => `DATE_FORMAT(CONVERT_TZ(${campo}, '+00:00', '${offsetZona()}'), '%Y-%m-%d')`;

export class ReporteRepository {
  async ventasPorDia([d, h]: Rango) {
    const [r] = await pool.query<RowDataPacket[]>(
      `SELECT ${dia('fecha_pago')} AS dia, COUNT(*) AS cantidad, SUM(monto_total) AS total
         FROM tbl_pagos WHERE estado = 'COMPLETADO' AND fecha_pago BETWEEN ? AND ?
        GROUP BY dia ORDER BY dia`,
      [d, h]
    );
    return r.map(x => ({ fecha: x.dia as string, cantidad: Number(x.cantidad), total: Number(x.total) }));
  }

  async ventasPorMetodo([d, h]: Rango) {
    const [r] = await pool.query<RowDataPacket[]>(
      `SELECT metodo_pago AS metodo, COUNT(*) AS cantidad, SUM(monto_total) AS total
         FROM tbl_pagos WHERE estado = 'COMPLETADO' AND fecha_pago BETWEEN ? AND ?
        GROUP BY metodo_pago ORDER BY total DESC`,
      [d, h]
    );
    return r.map(x => ({ metodo: x.metodo as string, cantidad: Number(x.cantidad), total: Number(x.total) }));
  }

  async ventasPorComprobante([d, h]: Rango) {
    const [r] = await pool.query<RowDataPacket[]>(
      `SELECT p.tipo_comprobante AS tipo, COUNT(*) AS cantidad, SUM(g.monto_total) AS total
         FROM tbl_pagos g JOIN tbl_pedidos p ON p.id_pedido = g.id_pedido
        WHERE g.estado = 'COMPLETADO' AND g.fecha_pago BETWEEN ? AND ?
        GROUP BY p.tipo_comprobante`,
      [d, h]
    );
    return r.map(x => ({ tipo: x.tipo as string, cantidad: Number(x.cantidad), total: Number(x.total) }));
  }

  async topProductos([d, h]: Rango, limite = 10) {
    const [r] = await pool.query<RowDataPacket[]>(
      `SELECT pr.codigo_sku AS sku, pr.nombre_completo AS nombre, c.nombre_categoria AS categoria,
              SUM(dp.cantidad) AS unidades, SUM(dp.subtotal) AS total
         FROM tbl_pagos g
         JOIN tbl_detalle_pedidos dp ON dp.id_pedido = g.id_pedido
         JOIN tbl_productos pr ON pr.id_producto = dp.id_producto
         JOIN tbl_categorias c ON c.id_categoria = pr.id_categoria
        WHERE g.estado = 'COMPLETADO' AND g.fecha_pago BETWEEN ? AND ?
        GROUP BY pr.id_producto, pr.codigo_sku, pr.nombre_completo, c.nombre_categoria
        ORDER BY unidades DESC, total DESC
        LIMIT ?`,
      [d, h, limite]
    );
    return r.map(x => ({ sku: x.sku as string, nombre: x.nombre as string, categoria: x.categoria as string, unidades: Number(x.unidades), total: Number(x.total) }));
  }

  async ventasPorCategoria([d, h]: Rango) {
    const [r] = await pool.query<RowDataPacket[]>(
      `SELECT c.nombre_categoria AS categoria, SUM(dp.cantidad) AS unidades, SUM(dp.subtotal) AS total
         FROM tbl_pagos g
         JOIN tbl_detalle_pedidos dp ON dp.id_pedido = g.id_pedido
         JOIN tbl_productos pr ON pr.id_producto = dp.id_producto
         JOIN tbl_categorias c ON c.id_categoria = pr.id_categoria
        WHERE g.estado = 'COMPLETADO' AND g.fecha_pago BETWEEN ? AND ?
        GROUP BY c.id_categoria, c.nombre_categoria ORDER BY total DESC`,
      [d, h]
    );
    return r.map(x => ({ categoria: x.categoria as string, unidades: Number(x.unidades), total: Number(x.total) }));
  }

  async topClientes([d, h]: Rango, limite = 10) {
    const [r] = await pool.query<RowDataPacket[]>(
      `SELECT p.razon_social_nombre AS cliente, p.numero_documento_comprobante AS documento,
              COUNT(*) AS pedidos, SUM(g.monto_total) AS total
         FROM tbl_pagos g JOIN tbl_pedidos p ON p.id_pedido = g.id_pedido
        WHERE g.estado = 'COMPLETADO' AND g.fecha_pago BETWEEN ? AND ?
        GROUP BY p.numero_documento_comprobante, p.razon_social_nombre
        ORDER BY total DESC LIMIT ?`,
      [d, h, limite]
    );
    return r.map(x => ({ cliente: x.cliente as string, documento: x.documento as string, pedidos: Number(x.pedidos), total: Number(x.total) }));
  }

  async pedidosPorEstado([d, h]: Rango) {
    const [r] = await pool.query<RowDataPacket[]>(
      `SELECT estado, COUNT(*) AS n FROM tbl_pedidos WHERE fecha_emision BETWEEN ? AND ? GROUP BY estado`,
      [d, h]
    );
    const o: Record<string, number> = {};
    r.forEach(x => (o[x.estado as string] = Number(x.n)));
    return o;
  }

  async comprasPorDia([d, h]: Rango) {
    const [r] = await pool.query<RowDataPacket[]>(
      `SELECT ${dia('fecha_compra')} AS dia, COUNT(*) AS cantidad, SUM(total) AS total
         FROM tbl_compras WHERE estado = 'REGISTRADA' AND fecha_compra BETWEEN ? AND ?
        GROUP BY dia ORDER BY dia`,
      [d, h]
    );
    return r.map(x => ({ fecha: x.dia as string, cantidad: Number(x.cantidad), total: Number(x.total) }));
  }

  async comprasPorProveedor([d, h]: Rango, limite = 10) {
    const [r] = await pool.query<RowDataPacket[]>(
      `SELECT proveedor_nombre AS proveedor, COUNT(*) AS cantidad, SUM(total) AS total
         FROM tbl_compras WHERE estado = 'REGISTRADA' AND fecha_compra BETWEEN ? AND ?
        GROUP BY proveedor_nombre ORDER BY total DESC LIMIT ?`,
      [d, h, limite]
    );
    return r.map(x => ({ proveedor: x.proveedor as string, cantidad: Number(x.cantidad), total: Number(x.total) }));
  }

  async inventario() {
    const [r] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS productos,
              COALESCE(SUM(stock_tienda + stock_almacen), 0) AS unidades,
              COALESCE(SUM((stock_tienda + stock_almacen) * precio), 0) AS valor,
              COALESCE(SUM(CASE WHEN stock_tienda + stock_almacen = 0 THEN 1 ELSE 0 END), 0) AS sin_stock,
              COALESCE(SUM(CASE WHEN stock_tienda + stock_almacen > 0
                                 AND stock_tienda + stock_almacen <= stock_minimo THEN 1 ELSE 0 END), 0) AS bajo_minimo
         FROM tbl_productos WHERE estado <> 'DESCONTINUADO'`
    );
    const [bajos] = await pool.query<RowDataPacket[]>(
      `SELECT codigo_sku AS sku, nombre_completo AS nombre, stock_tienda, stock_almacen, stock_minimo
         FROM tbl_productos
        WHERE estado <> 'DESCONTINUADO' AND stock_tienda + stock_almacen <= stock_minimo
        ORDER BY stock_tienda + stock_almacen ASC LIMIT 15`
    );
    const x = r[0];
    return {
      productos: Number(x.productos),
      unidades: Number(x.unidades),
      valorVenta: Number(x.valor),
      sinStock: Number(x.sin_stock),
      bajoMinimo: Number(x.bajo_minimo),
      criticos: bajos.map(b => ({
        sku: b.sku as string, nombre: b.nombre as string,
        stock: Number(b.stock_tienda) + Number(b.stock_almacen), stockMinimo: Number(b.stock_minimo)
      }))
    };
  }
}

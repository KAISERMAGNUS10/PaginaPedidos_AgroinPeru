import { Conexion, Fila, pool, ResultadoEscritura } from '../config/database';

export interface CompraRow extends Fila {
  id_compra: number;
  codigo_compra: string;
  proveedor_nombre: string;
  proveedor_ruc: string | null;
  tipo_comprobante: string;
  numero_comprobante: string | null;
  ubicacion_destino: 'TIENDA' | 'ALMACEN';
  subtotal: number;
  igv: number;
  total: number;
  estado: 'REGISTRADA' | 'ANULADA';
  observaciones: string | null;
  fecha_compra: Date;
  fecha_anulacion: Date | null;
  usuario: string;
  items: number;
  unidades: number;
}

export interface DetalleCompraRow extends Fila {
  id_producto: number;
  codigo_sku: string;
  nombre_completo: string;
  cantidad: number;
  costo_unitario: number;
  subtotal: number;
}

const SELECT_COMPRA = `
  SELECT c.*, CONCAT(u.nombres, ' ', u.apellidos) AS usuario,
         (SELECT COUNT(*) FROM tbl_detalle_compras d WHERE d.id_compra = c.id_compra) AS items,
         (SELECT COALESCE(SUM(d.cantidad), 0) FROM tbl_detalle_compras d WHERE d.id_compra = c.id_compra) AS unidades
    FROM tbl_compras c
    JOIN tbl_usuarios u ON u.id_usuario = c.id_usuario
`;

export class CompraRepository {
  async listar(filtro: { where: string[]; params: unknown[] }): Promise<CompraRow[]> {
    const [rows] = await pool.query<CompraRow[]>(
      `${SELECT_COMPRA}
       ${filtro.where.length ? 'WHERE ' + filtro.where.join(' AND ') : ''}
       ORDER BY c.fecha_compra DESC, c.id_compra DESC
       LIMIT 500`,
      filtro.params
    );
    return rows;
  }

  async porCodigo(codigo: string): Promise<CompraRow | null> {
    const [rows] = await pool.query<CompraRow[]>(`${SELECT_COMPRA} WHERE c.codigo_compra = ? LIMIT 1`, [codigo]);
    return rows[0] ?? null;
  }

  async detalle(idCompra: number, conexion?: Conexion): Promise<DetalleCompraRow[]> {
    const [rows] = await (conexion ?? pool).query<DetalleCompraRow[]>(
      `SELECT d.id_producto, p.codigo_sku, p.nombre_completo, d.cantidad, d.costo_unitario, d.subtotal
         FROM tbl_detalle_compras d
         JOIN tbl_productos p ON p.id_producto = d.id_producto
        WHERE d.id_compra = ?
        ORDER BY d.id_detalle_compra`,
      [idCompra]
    );
    return rows;
  }

  async siguienteCodigo(conexion: Conexion): Promise<string> {
    const prefijo = `C-${new Date().getUTCFullYear()}-`;
    const [rows] = await conexion.query<Fila[]>(
      `SELECT COALESCE(MAX(CAST(SUBSTRING(codigo_compra FROM ?::int) AS INTEGER)), 0) AS ultimo
         FROM tbl_compras WHERE codigo_compra LIKE ?`,
      [prefijo.length + 1, `${prefijo}%`]
    );
    return `${prefijo}${String(Number(rows[0].ultimo) + 1).padStart(5, '0')}`;
  }

  async crear(
    conexion: Conexion,
    datos: {
      codigo: string;
      idUsuario: number;
      proveedorNombre: string;
      proveedorRuc: string | null;
      tipoComprobante: string;
      numeroComprobante: string | null;
      ubicacion: string;
      subtotal: number;
      igv: number;
      total: number;
      observaciones: string | null;
    },
    lineas: Array<{ id_producto: number; cantidad: number; costo: number; subtotal: number }>
  ): Promise<number> {
    const [res] = await conexion.execute<ResultadoEscritura>(
      `INSERT INTO tbl_compras
         (codigo_compra, id_usuario, proveedor_nombre, proveedor_ruc, tipo_comprobante,
          numero_comprobante, ubicacion_destino, subtotal, igv, total, observaciones)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING id_compra AS "insertId"`,
      [
        datos.codigo, datos.idUsuario, datos.proveedorNombre, datos.proveedorRuc,
        datos.tipoComprobante, datos.numeroComprobante, datos.ubicacion,
        datos.subtotal, datos.igv, datos.total, datos.observaciones
      ]
    );

    for (const l of lineas) {
      await conexion.execute(
        `INSERT INTO tbl_detalle_compras (id_compra, id_producto, cantidad, costo_unitario, subtotal)
         VALUES (?, ?, ?, ?, ?)`,
        [res.insertId, l.id_producto, l.cantidad, l.costo, l.subtotal]
      );
    }
    return res.insertId;
  }

  async bloquearPorCodigo(conexion: Conexion, codigo: string): Promise<CompraRow | null> {
    const [rows] = await conexion.query<CompraRow[]>(
      'SELECT * FROM tbl_compras WHERE codigo_compra = ? LIMIT 1 FOR UPDATE',
      [codigo]
    );
    return rows[0] ?? null;
  }

  async marcarAnulada(conexion: Conexion, idCompra: number): Promise<void> {
    await conexion.execute(
      "UPDATE tbl_compras SET estado = 'ANULADA', fecha_anulacion = NOW() WHERE id_compra = ?",
      [idCompra]
    );
  }
}

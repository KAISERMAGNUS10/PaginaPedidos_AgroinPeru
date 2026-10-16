import { Conexion, contiene, Fila, pool, ResultadoEscritura } from '../config/database';
import { ProductoDto } from '../models/producto.model';

export interface ProductoRow extends Fila {
  id_producto: number;
  codigo_sku: string;
  nombre: string;
  nombre_completo: string;
  nombre_categoria: string;
  subcategoria: string | null;
  medida: string | null;
  cantidad_caja: number | null;
  cantidad_bolsa: number | null;
  precio: number;
  stock_tienda: number;
  stock_almacen: number;
  stock_minimo: number;
  imagen_url: string | null;
  descripcion: string | null;
  descripcion_fotografica: string | null;
  estado: 'DISPONIBLE' | 'AGOTADO' | 'DESCONTINUADO';
}

const SELECT_PRODUCTO = `
  SELECT p.id_producto, p.codigo_sku, p.nombre, p.nombre_completo,
         c.nombre_categoria, p.subcategoria, p.medida,
         p.cantidad_caja, p.cantidad_bolsa, p.precio,
         p.stock_tienda, p.stock_almacen, p.stock_minimo,
         p.imagen_url, p.descripcion, p.descripcion_fotografica, p.estado
    FROM tbl_productos p
    JOIN tbl_categorias c ON c.id_categoria = p.id_categoria
`;

export function aProductoDto(fila: ProductoRow): ProductoDto {
  const stock = Number(fila.stock_tienda) + Number(fila.stock_almacen);

  return {
    id: fila.codigo_sku,
    nombre: fila.nombre,
    nombreCompleto: fila.nombre_completo,
    categoria: fila.nombre_categoria,
    subcategoria: fila.subcategoria ?? '',
    medida: fila.medida ?? '',
    cantidadCaja: fila.cantidad_caja || null,
    cantidadBolsa: fila.cantidad_bolsa || null,
    precio: Number(fila.precio),
    imagen: fila.imagen_url ?? '',
    descripcion: fila.descripcion ?? '',
    descripcionFotografica: fila.descripcion_fotografica ?? '',
    stock,
    disponible: fila.estado === 'DISPONIBLE' && stock > 0
  };
}

export class ProductoRepository {
  async listar(filtros: { categoria?: string; q?: string; incluirDescontinuados?: boolean }): Promise<ProductoRow[]> {
    const where: string[] = filtros.incluirDescontinuados ? ['1 = 1'] : ["p.estado <> 'DESCONTINUADO'"];
    const params: unknown[] = [];

    if (filtros.categoria) {
      where.push('c.nombre_categoria = ?');
      params.push(filtros.categoria);
    }

    if (filtros.q) {
      where.push(`(${contiene('p.nombre_completo')} OR ${contiene('p.codigo_sku')} OR ${contiene('c.nombre_categoria')})`);
      const like = `%${filtros.q}%`;
      params.push(like, like, like);
    }

    const [rows] = await pool.query<ProductoRow[]>(
      `${SELECT_PRODUCTO} WHERE ${where.join(' AND ')} ORDER BY p.id_producto ASC`,
      params
    );
    return rows;
  }

  async porSku(sku: string): Promise<ProductoRow | null> {
    const [rows] = await pool.query<ProductoRow[]>(
      `${SELECT_PRODUCTO} WHERE p.codigo_sku = ? LIMIT 1`,
      [sku]
    );
    return rows[0] ?? null;
  }

  async porSkus(skus: string[]): Promise<ProductoRow[]> {
    if (skus.length === 0) return [];
    const [rows] = await pool.query<ProductoRow[]>(
      `${SELECT_PRODUCTO} WHERE p.codigo_sku = ANY(?)`,
      [skus]
    );
    return rows;
  }

  /** Igual que porSkus pero bloquea las filas (usar dentro de una transacción). */
  async bloquearPorSkus(conexion: Conexion, skus: string[]): Promise<ProductoRow[]> {
    if (skus.length === 0) return [];
    const [rows] = await conexion.query<ProductoRow[]>(
      `${SELECT_PRODUCTO} WHERE p.codigo_sku = ANY(?) ORDER BY p.id_producto FOR UPDATE OF p`,
      [skus]
    );
    return rows;
  }

  async bloquearPorIds(conexion: Conexion, ids: number[]): Promise<ProductoRow[]> {
    if (ids.length === 0) return [];
    const [rows] = await conexion.query<ProductoRow[]>(
      `${SELECT_PRODUCTO} WHERE p.id_producto = ANY(?) ORDER BY p.id_producto FOR UPDATE OF p`,
      [ids]
    );
    return rows;
  }

  async categorias(): Promise<Array<{ nombre: string; cantidad: number }>> {
    const [rows] = await pool.query<Fila[]>(
      `SELECT c.nombre_categoria AS nombre, COUNT(p.id_producto) AS cantidad
         FROM tbl_categorias c
         LEFT JOIN tbl_productos p
                ON p.id_categoria = c.id_categoria AND p.estado <> 'DESCONTINUADO'
        WHERE c.estado = 'ACTIVO'
        GROUP BY c.id_categoria, c.nombre_categoria
        ORDER BY MIN(c.id_categoria)`
    );
    return rows.map(r => ({ nombre: r.nombre as string, cantidad: Number(r.cantidad) }));
  }

  async actualizarStock(
    conexion: Conexion,
    idProducto: number,
    stockTienda: number,
    stockAlmacen: number
  ): Promise<void> {
    await conexion.execute(
      'UPDATE tbl_productos SET stock_tienda = ?, stock_almacen = ? WHERE id_producto = ?',
      [stockTienda, stockAlmacen, idProducto]
    );
  }

  /** Devuelve el id de la categoría; si no existe la crea. */
  async categoriaPorNombre(conexion: Conexion, nombre: string): Promise<number> {
    const [rows] = await conexion.query<Fila[]>(
      'SELECT id_categoria FROM tbl_categorias WHERE nombre_categoria = ? LIMIT 1',
      [nombre]
    );
    if (rows[0]) return Number(rows[0].id_categoria);

    const codigo = nombre
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
      .replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'CAT';

    const [res] = await conexion.execute<ResultadoEscritura>(
      `INSERT INTO tbl_categorias (codigo_categoria, nombre_categoria) VALUES (?, ?)
       RETURNING id_categoria AS "insertId"`,
      [codigo, nombre]
    );
    return res.insertId;
  }

  async crear(
    conexion: Conexion,
    d: {
      sku: string; idCategoria: number; nombre: string; nombreCompleto: string;
      subcategoria: string | null; medida: string | null;
      cantidadCaja: number | null; cantidadBolsa: number | null;
      precio: number; stockTienda: number; stockAlmacen: number; stockMinimo: number;
      imagen: string | null; descripcion: string | null;
    }
  ): Promise<number> {
    const [res] = await conexion.execute<ResultadoEscritura>(
      `INSERT INTO tbl_productos
         (codigo_sku, id_categoria, nombre, nombre_completo, subcategoria, medida,
          cantidad_caja, cantidad_bolsa, precio, stock_tienda, stock_almacen, stock_minimo,
          imagen_url, descripcion, descripcion_fotografica)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING id_producto AS "insertId"`,
      [d.sku, d.idCategoria, d.nombre, d.nombreCompleto, d.subcategoria, d.medida,
       d.cantidadCaja, d.cantidadBolsa, d.precio, d.stockTienda, d.stockAlmacen, d.stockMinimo,
       d.imagen, d.descripcion, d.descripcion]
    );
    return res.insertId;
  }

  async actualizar(
    conexion: Conexion,
    idProducto: number,
    campos: Record<string, string | number | null>
  ): Promise<void> {
    const columnas = Object.keys(campos);
    if (columnas.length === 0) return;

    await conexion.execute(
      `UPDATE tbl_productos SET ${columnas.map(c => `${c} = ?`).join(', ')} WHERE id_producto = ?`,
      [...Object.values(campos), idProducto]
    );
  }
}

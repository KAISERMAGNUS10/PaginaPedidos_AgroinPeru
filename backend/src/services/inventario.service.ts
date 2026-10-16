import { Conexion, conTransaccion, PG_VALOR_DUPLICADO } from '../config/database';
import {
  InventarioRepository,
  MovimientoRow,
  TipoMovimiento,
  Ubicacion
} from '../repositories/inventario.repository';
import { ProductoRepository, ProductoRow } from '../repositories/producto.repository';
import { badRequest, conflicto, noEncontrado } from '../utils/errores';
import { enteroPositivo, texto } from '../utils/validadores';

const repoInv = new InventarioRepository();
const repoProd = new ProductoRepository();

export class InventarioService {
  /* ------------------------------------------------------------------
   * Usado por los pedidos (todo dentro de la transacción del pedido)
   * ------------------------------------------------------------------ */

  /** Descuenta stock: primero del almacén y, si falta, de la tienda. */
  async descontarParaPedido(
    conexion: Conexion,
    producto: ProductoRow,
    cantidad: number,
    idUsuario: number,
    idPedido: number,
    codigoTicket: string
  ): Promise<void> {
    let almacen = Number(producto.stock_almacen);
    let tienda = Number(producto.stock_tienda);
    let falta = cantidad;

    const deAlmacen = Math.min(almacen, falta);

    if (deAlmacen > 0) {
      await repoInv.registrarMovimiento(conexion, {
        id_producto: producto.id_producto,
        id_usuario: idUsuario,
        id_pedido: idPedido,
        tipo_movimiento: 'SALIDA',
        ubicacion_origen: 'ALMACEN',
        cantidad: deAlmacen,
        stock_anterior: almacen,
        stock_posterior: almacen - deAlmacen,
        motivo: `Reserva por pedido ${codigoTicket}`
      });
      almacen -= deAlmacen;
      falta -= deAlmacen;
    }

    if (falta > 0) {
      await repoInv.registrarMovimiento(conexion, {
        id_producto: producto.id_producto,
        id_usuario: idUsuario,
        id_pedido: idPedido,
        tipo_movimiento: 'SALIDA',
        ubicacion_origen: 'TIENDA',
        cantidad: falta,
        stock_anterior: tienda,
        stock_posterior: tienda - falta,
        motivo: `Reserva por pedido ${codigoTicket}`
      });
      tienda -= falta;
    }

    await repoProd.actualizarStock(conexion, producto.id_producto, tienda, almacen);
  }

  /** Devuelve al stock lo que había descontado un pedido (cancelación / expiración). */
  async restaurarPedido(
    conexion: Conexion,
    idPedido: number,
    idUsuario: number,
    motivo: string
  ): Promise<void> {
    const salidas = await repoInv.salidasDePedido(conexion, idPedido);
    if (salidas.length === 0) return;

    const ids = [...new Set(salidas.map(s => s.id_producto))];
    const productos = await repoProd.bloquearPorIds(conexion, ids);

    const stock = new Map<number, { tienda: number; almacen: number }>();
    productos.forEach(p =>
      stock.set(p.id_producto, {
        tienda: Number(p.stock_tienda),
        almacen: Number(p.stock_almacen)
      })
    );

    for (const s of salidas) {
      const actual = stock.get(s.id_producto);
      if (!actual) continue;

      const campo = s.ubicacion === 'TIENDA' ? 'tienda' : 'almacen';
      const antes = actual[campo];
      actual[campo] = antes + s.cantidad;

      await repoInv.registrarMovimiento(conexion, {
        id_producto: s.id_producto,
        id_usuario: idUsuario,
        id_pedido: idPedido,
        tipo_movimiento: 'ENTRADA',
        ubicacion_destino: s.ubicacion,
        cantidad: s.cantidad,
        stock_anterior: antes,
        stock_posterior: actual[campo],
        motivo
      });
    }

    for (const [idProducto, actual] of stock) {
      await repoProd.actualizarStock(conexion, idProducto, actual.tienda, actual.almacen);
    }
  }

  /* ------------------------------------------------------------------
   * Panel de inventario (ADMIN)
   * ------------------------------------------------------------------ */

  async listarStock(filtros: { q?: string; bajoMinimo?: boolean }) {
    const productos = await repoProd.listar({ q: filtros.q, incluirDescontinuados: true });

    const lista = productos.map(p => ({
      id: p.codigo_sku,
      nombre: p.nombre_completo,
      nombreBase: p.nombre,
      categoria: p.nombre_categoria,
      subcategoria: p.subcategoria ?? '',
      medida: p.medida ?? '',
      cantidadCaja: p.cantidad_caja || null,
      cantidadBolsa: p.cantidad_bolsa || null,
      precio: Number(p.precio),
      imagen: p.imagen_url ?? '',
      descripcion: p.descripcion ?? '',
      stockTienda: Number(p.stock_tienda),
      stockAlmacen: Number(p.stock_almacen),
      stockTotal: Number(p.stock_tienda) + Number(p.stock_almacen),
      stockMinimo: Number(p.stock_minimo),
      estado: p.estado,
      bajoMinimo: Number(p.stock_tienda) + Number(p.stock_almacen) <= Number(p.stock_minimo)
    }));

    return filtros.bajoMinimo ? lista.filter(p => p.bajoMinimo) : lista;
  }

  async movimientos(filtros: { sku?: string; tipo?: string; limite?: number }): Promise<MovimientoRow[]> {
    const limite = Math.min(Math.max(Number(filtros.limite) || 100, 1), 500);
    return repoInv.listarMovimientos({ sku: filtros.sku, tipo: filtros.tipo, limite });
  }

  async registrarMovimiento(
    idUsuario: number,
    body: {
      sku?: string;
      tipo?: string;
      cantidad?: number;
      ubicacion?: string;
      origen?: string;
      destino?: string;
      motivo?: string;
    }
  ) {
    const sku = texto(body.sku);
    const tipo = texto(body.tipo).toUpperCase() as TipoMovimiento;
    const motivo = texto(body.motivo) || null;

    if (!sku) throw badRequest('SKU_OBLIGATORIO', 'Indica el SKU del producto.');
    if (!['ENTRADA', 'SALIDA', 'AJUSTE', 'TRASLADO'].includes(tipo)) {
      throw badRequest('TIPO_MOVIMIENTO_INVALIDO', 'Tipo: ENTRADA, SALIDA, AJUSTE o TRASLADO.');
    }

    const ubicacionValida = (v: unknown): Ubicacion => {
      const u = texto(v).toUpperCase();
      if (u !== 'TIENDA' && u !== 'ALMACEN') {
        throw badRequest('UBICACION_INVALIDA', 'Ubicación: TIENDA o ALMACEN.');
      }
      return u as Ubicacion;
    };

    await conTransaccion(async conexion => {
      const [producto] = await repoProd.bloquearPorSkus(conexion, [sku]);
      if (!producto) throw noEncontrado('PRODUCTO_NO_ENCONTRADO', 'El producto no existe.');

      const stock = {
        TIENDA: Number(producto.stock_tienda),
        ALMACEN: Number(producto.stock_almacen)
      };

      if (tipo === 'TRASLADO') {
        const origen = ubicacionValida(body.origen);
        const destino = ubicacionValida(body.destino);
        const cantidad = enteroPositivo(body.cantidad);

        if (origen === destino) {
          throw badRequest('TRASLADO_INVALIDO', 'Origen y destino deben ser distintos.');
        }
        if (stock[origen] < cantidad) {
          throw badRequest('STOCK_INSUFICIENTE', `No hay suficiente stock en ${origen}.`);
        }

        const o1 = stock[origen];
        const d1 = stock[destino];
        stock[origen] -= cantidad;
        stock[destino] += cantidad;

        await repoInv.registrarMovimiento(conexion, {
          id_producto: producto.id_producto,
          id_usuario: idUsuario,
          tipo_movimiento: 'TRASLADO',
          ubicacion_origen: origen,
          ubicacion_destino: destino,
          cantidad,
          stock_anterior: o1,
          stock_posterior: stock[origen],
          motivo: `${motivo ?? 'Traslado'} (salida de ${origen})`
        });
        await repoInv.registrarMovimiento(conexion, {
          id_producto: producto.id_producto,
          id_usuario: idUsuario,
          tipo_movimiento: 'TRASLADO',
          ubicacion_origen: origen,
          ubicacion_destino: destino,
          cantidad,
          stock_anterior: d1,
          stock_posterior: stock[destino],
          motivo: `${motivo ?? 'Traslado'} (entrada a ${destino})`
        });
      } else {
        const ubicacion = ubicacionValida(body.ubicacion);
        const anterior = stock[ubicacion];
        let posterior: number;
        let cantidad: number;

        if (tipo === 'AJUSTE') {
          // En un ajuste, `cantidad` es el stock final que debe quedar.
          const nuevo = Number(body.cantidad);
          if (!Number.isInteger(nuevo) || nuevo < 0) {
            throw badRequest('CANTIDAD_INVALIDA', 'El stock final debe ser un entero >= 0.');
          }
          if (nuevo === anterior) {
            throw badRequest('AJUSTE_SIN_CAMBIOS', 'El stock ya tiene ese valor.');
          }
          posterior = nuevo;
          cantidad = Math.abs(nuevo - anterior);
        } else {
          cantidad = enteroPositivo(body.cantidad);
          posterior = tipo === 'ENTRADA' ? anterior + cantidad : anterior - cantidad;
          if (posterior < 0) {
            throw badRequest('STOCK_INSUFICIENTE', `No hay suficiente stock en ${ubicacion}.`);
          }
        }

        stock[ubicacion] = posterior;

        await repoInv.registrarMovimiento(conexion, {
          id_producto: producto.id_producto,
          id_usuario: idUsuario,
          tipo_movimiento: tipo,
          ubicacion_origen: tipo === 'ENTRADA' ? null : ubicacion,
          ubicacion_destino: tipo === 'SALIDA' ? null : ubicacion,
          cantidad,
          stock_anterior: anterior,
          stock_posterior: posterior,
          motivo
        });
      }

      await repoProd.actualizarStock(conexion, producto.id_producto, stock.TIENDA, stock.ALMACEN);
    });

    const [actualizado] = await repoProd.porSkus([sku]);
    return {
      id: actualizado.codigo_sku,
      stockTienda: Number(actualizado.stock_tienda),
      stockAlmacen: Number(actualizado.stock_almacen)
    };
  }

  /* ------------------------------------------------------------------
   * Alta y edición de productos
   * ------------------------------------------------------------------ */

  async crearProducto(idUsuario: number, body: any) {
    const sku = texto(body?.id ?? body?.sku).toUpperCase().replace(/\s+/g, '-');
    const nombre = texto(body?.nombre);
    const categoria = texto(body?.categoria);
    const precio = Number(body?.precio);
    const stockTienda = Number(body?.stockTienda ?? 0);
    const stockAlmacen = Number(body?.stockAlmacen ?? 0);
    const stockMinimo = Number(body?.stockMinimo ?? 10);
    const medida = texto(body?.medida);

    if (!/^[A-Z0-9][A-Z0-9._-]{1,79}$/.test(sku)) {
      throw badRequest('SKU_INVALIDO', 'El SKU debe tener entre 2 y 80 caracteres (letras, números, guion o punto).');
    }
    if (nombre.length < 3) throw badRequest('NOMBRE_INVALIDO', 'Ingresa el nombre del producto.');
    if (categoria.length < 2) throw badRequest('CATEGORIA_INVALIDA', 'Elige o escribe una categoría.');
    if (!Number.isFinite(precio) || precio <= 0) throw badRequest('PRECIO_INVALIDO', 'El precio debe ser mayor a 0.');
    for (const [v, c] of [[stockTienda, 'stock de tienda'], [stockAlmacen, 'stock de almacén'], [stockMinimo, 'stock mínimo']] as const) {
      if (!Number.isInteger(v) || v < 0) throw badRequest('STOCK_INVALIDO', `El ${c} debe ser un entero mayor o igual a 0.`);
    }

    const entero = (v: unknown) => (v === '' || v === null || v === undefined || Number(v) <= 0 ? null : Math.floor(Number(v)));

    try {
      await conTransaccion(async conexion => {
        const idCategoria = await repoProd.categoriaPorNombre(conexion, categoria);
        const nombreCompleto = texto(body?.nombreCompleto) || (medida ? `${nombre} - ${medida}` : nombre);

        const idProducto = await repoProd.crear(conexion, {
          sku, idCategoria, nombre, nombreCompleto,
          subcategoria: texto(body?.subcategoria) || null,
          medida: medida || null,
          cantidadCaja: entero(body?.cantidadCaja),
          cantidadBolsa: entero(body?.cantidadBolsa),
          precio, stockTienda, stockAlmacen, stockMinimo,
          imagen: texto(body?.imagen) || null,
          descripcion: texto(body?.descripcion) || null
        });

        // El stock inicial queda registrado en el kardex.
        for (const [ubic, cant] of [['TIENDA', stockTienda], ['ALMACEN', stockAlmacen]] as const) {
          if (cant > 0) {
            await repoInv.registrarMovimiento(conexion, {
              id_producto: idProducto, id_usuario: idUsuario, tipo_movimiento: 'ENTRADA',
              ubicacion_destino: ubic, cantidad: cant, stock_anterior: 0, stock_posterior: cant,
              motivo: 'Stock inicial al crear el producto'
            });
          }
        }
      });
    } catch (error: any) {
      if (error?.code === PG_VALOR_DUPLICADO) throw conflicto('SKU_DUPLICADO', 'Ya existe un producto con ese SKU.');
      throw error;
    }

    return (await this.listarStock({ q: sku })).find(p => p.id === sku);
  }

  async actualizarProducto(sku: string, body: any) {
    const campos: Record<string, string | number | null> = {};

    if (body?.nombre !== undefined) {
      const v = texto(body.nombre);
      if (v.length < 3) throw badRequest('NOMBRE_INVALIDO', 'Ingresa el nombre del producto.');
      campos.nombre = v;
    }
    if (body?.nombreCompleto !== undefined) {
      const v = texto(body.nombreCompleto);
      if (v.length < 3) throw badRequest('NOMBRE_INVALIDO', 'Ingresa el nombre completo.');
      campos.nombre_completo = v;
    }
    if (body?.precio !== undefined) {
      const v = Number(body.precio);
      if (!Number.isFinite(v) || v <= 0) throw badRequest('PRECIO_INVALIDO', 'El precio debe ser mayor a 0.');
      campos.precio = v;
    }
    if (body?.stockMinimo !== undefined) {
      const v = Number(body.stockMinimo);
      if (!Number.isInteger(v) || v < 0) throw badRequest('STOCK_INVALIDO', 'El stock mínimo debe ser un entero >= 0.');
      campos.stock_minimo = v;
    }
    if (body?.estado !== undefined) {
      const v = texto(body.estado).toUpperCase();
      if (!['DISPONIBLE', 'AGOTADO', 'DESCONTINUADO'].includes(v)) throw badRequest('ESTADO_INVALIDO', 'Estado no válido.');
      campos.estado = v;
    }
    for (const [clave, col] of [['subcategoria', 'subcategoria'], ['medida', 'medida'], ['imagen', 'imagen_url'], ['descripcion', 'descripcion']] as const) {
      if (body?.[clave] !== undefined) campos[col] = texto(body[clave]) || null;
    }
    for (const [clave, col] of [['cantidadCaja', 'cantidad_caja'], ['cantidadBolsa', 'cantidad_bolsa']] as const) {
      if (body?.[clave] !== undefined) {
        const n = Number(body[clave]);
        campos[col] = body[clave] === '' || body[clave] === null || !(n > 0) ? null : Math.floor(n);
      }
    }

    await conTransaccion(async conexion => {
      const [producto] = await repoProd.bloquearPorSkus(conexion, [sku]);
      if (!producto) throw noEncontrado('PRODUCTO_NO_ENCONTRADO', 'El producto no existe.');

      if (body?.categoria !== undefined && texto(body.categoria)) {
        const idCategoria = await repoProd.categoriaPorNombre(conexion, texto(body.categoria));
        campos.id_categoria = idCategoria;
      }
      await repoProd.actualizar(conexion, producto.id_producto, campos);
    });

    return (await this.listarStock({ q: sku })).find(p => p.id === sku);
  }
}

import { CarritoRepository, ItemCarritoRow } from '../repositories/carrito.repository';
import { ProductoRepository } from '../repositories/producto.repository';
import { badRequest, conflicto, noEncontrado } from '../utils/errores';
import { redondear2 } from '../utils/fechas';
import { enteroPositivo, pick, texto } from '../utils/validadores';

const repo = new CarritoRepository();
const repoProd = new ProductoRepository();

/** Misma forma que ItemCarrito del frontend (+ id/sku). */
function aItem(f: ItemCarritoRow) {
  const precio = Number(f.precio);
  const cantidad = Number(f.cantidad);
  return {
    id: f.codigo_sku,
    nombre: f.nombre_completo,
    precio,
    qty: cantidad,
    cantidad,
    imagen: f.imagen_url ?? '',
    cantidadCaja: f.cantidad_caja || null,
    cantidadBolsa: f.cantidad_bolsa || null,
    categoria: f.nombre_categoria,
    subcategoria: f.subcategoria,
    medida: f.medida,
    subtotal: redondear2(precio * cantidad),
    stock: Number(f.stock)
  };
}

export class CarritoService {
  async obtener(idUsuario: number) {
    const idCarrito = await repo.carritoActivoId(idUsuario);
    const filas = idCarrito ? await repo.items(idCarrito) : [];
    const items = filas.map(aItem);

    return {
      items,
      totalItems: items.reduce((a, i) => a + i.cantidad, 0),
      total: redondear2(items.reduce((a, i) => a + i.subtotal, 0))
    };
  }

  private async productoValido(sku: string, cantidad: number) {
    const producto = await repoProd.porSku(sku);

    if (!producto || producto.estado === 'DESCONTINUADO') {
      throw noEncontrado('PRODUCTO_NO_ENCONTRADO', `El producto ${sku} no existe.`);
    }
    if (producto.estado !== 'DISPONIBLE') {
      throw conflicto('PRODUCTO_NO_DISPONIBLE', `${producto.nombre_completo} no está disponible.`);
    }

    const stock = Number(producto.stock_tienda) + Number(producto.stock_almacen);
    if (cantidad > stock) {
      throw conflicto(
        'STOCK_INSUFICIENTE',
        `Solo hay ${stock} unidad(es) disponibles de ${producto.nombre_completo}.`
      );
    }
    return producto;
  }

  /** Suma `cantidad` a lo que ya hay en el carrito. */
  async agregar(idUsuario: number, body: any) {
    const sku = texto(pick(body, 'id', 'sku'));
    if (!sku) throw badRequest('SKU_OBLIGATORIO', 'Indica el producto (id / sku).');

    const cantidad = enteroPositivo(pick(body, 'cantidad', 'qty') ?? 1);
    const idCarrito = await repo.obtenerOCrearActivo(idUsuario);

    const producto = await repoProd.porSku(sku);
    const actual = producto ? await repo.cantidadActual(idCarrito, producto.id_producto) : 0;
    const nueva = actual + cantidad;

    const validado = await this.productoValido(sku, nueva);
    await repo.fijarCantidad(idCarrito, validado.id_producto, nueva, Number(validado.precio));

    return this.obtener(idUsuario);
  }

  /** Fija la cantidad exacta de un producto. */
  async fijarCantidad(idUsuario: number, sku: string, cantidadBruta: unknown) {
    const cantidad = enteroPositivo(cantidadBruta);
    const validado = await this.productoValido(sku, cantidad);
    const idCarrito = await repo.obtenerOCrearActivo(idUsuario);

    await repo.fijarCantidad(idCarrito, validado.id_producto, cantidad, Number(validado.precio));
    return this.obtener(idUsuario);
  }

  async quitar(idUsuario: number, sku: string) {
    const idCarrito = await repo.carritoActivoId(idUsuario);
    const producto = await repoProd.porSku(sku);

    if (idCarrito && producto) await repo.quitar(idCarrito, producto.id_producto);
    return this.obtener(idUsuario);
  }

  async vaciar(idUsuario: number) {
    const idCarrito = await repo.carritoActivoId(idUsuario);
    if (idCarrito) await repo.vaciar(idCarrito);
    return this.obtener(idUsuario);
  }

  /**
   * Reemplaza el carrito por la lista recibida. Sirve para subir a la BD el carrito que el
   * navegador tenía en localStorage (agro_carrito_obj) justo después de iniciar sesión.
   * Los productos inexistentes o sin stock se omiten y se informan en `omitidos`.
   */
  async reemplazar(idUsuario: number, body: any) {
    const lista: any[] = Array.isArray(body?.items) ? body.items : [];
    const idCarrito = await repo.obtenerOCrearActivo(idUsuario);

    await repo.vaciar(idCarrito);

    const omitidos: Array<{ id: string; motivo: string }> = [];
    const acumulado = new Map<string, number>();

    for (const it of lista) {
      const sku = texto(pick(it, 'id', 'sku'));
      const cant = Number(pick(it, 'cantidad', 'qty'));
      if (!sku || !Number.isInteger(cant) || cant <= 0) continue;
      acumulado.set(sku, (acumulado.get(sku) ?? 0) + cant);
    }

    for (const [sku, cantidad] of acumulado) {
      try {
        const p = await this.productoValido(sku, cantidad);
        await repo.fijarCantidad(idCarrito, p.id_producto, cantidad, Number(p.precio));
      } catch (e: any) {
        omitidos.push({ id: sku, motivo: e?.codigo ?? 'ERROR' });
      }
    }

    return { ...(await this.obtener(idUsuario)), omitidos };
  }
}

import { aProductoDto, OrdenCatalogo, ProductoRepository } from '../repositories/producto.repository';
import { TiendaRepository } from '../repositories/tienda.repository';
import { noEncontrado } from '../utils/errores';
import { texto } from '../utils/validadores';

const repo = new ProductoRepository();
const repoTienda = new TiendaRepository();

export class ProductoService {
  async listar(query: { categoria?: unknown; q?: unknown; pagina?: unknown; limite?: unknown; orden?: unknown }) {
    // Con ?pagina= el catálogo se entrega por páginas (lo usa la página de inicio).
    if (query.pagina !== undefined) return this.paginar(query);

    const filas = await repo.listar({
      categoria: texto(query.categoria) || undefined,
      q: texto(query.q) || undefined
    });
    return filas.map(aProductoDto);
  }

  /**
   * Catálogo paginado.
   * ?pagina=1&limite=12&q=codo 1/2&categoria=Válvulas,Mangueras&orden=precio-asc
   */
  async paginar(query: { categoria?: unknown; q?: unknown; pagina?: unknown; limite?: unknown; orden?: unknown }) {
    const limite = Math.min(Math.max(Number.parseInt(String(query.limite ?? ''), 10) || 12, 1), 60);
    const paginaPedida = Math.max(Number.parseInt(String(query.pagina ?? ''), 10) || 1, 1);
    const palabras = texto(query.q).split(/\s+/).filter(Boolean).slice(0, 6);
    const categorias = texto(query.categoria).split(',').map(c => c.trim()).filter(Boolean);
    const ordenes: OrdenCatalogo[] = ['relevancia', 'precio-asc', 'precio-desc', 'nombre'];
    const orden = ordenes.includes(query.orden as OrdenCatalogo) ? (query.orden as OrdenCatalogo) : 'relevancia';

    let pagina = paginaPedida;
    let { filas, total } = await repo.paginar({ palabras, categorias, orden, limite, offset: (pagina - 1) * limite });
    const paginas = Math.max(Math.ceil(total / limite), 1);

    // Si piden una página que ya no existe (p. ej. después de filtrar), se entrega la última.
    if (filas.length === 0 && total > 0 && pagina > paginas) {
      pagina = paginas;
      ({ filas } = await repo.paginar({ palabras, categorias, orden, limite, offset: (pagina - 1) * limite }));
    }

    return { productos: filas.map(aProductoDto), total, pagina, paginas, limite };
  }

  async detalle(sku: string) {
    const fila = await repo.porSku(sku);
    if (!fila || fila.estado === 'DESCONTINUADO') {
      throw noEncontrado('PRODUCTO_NO_ENCONTRADO', 'El producto no existe.');
    }
    return aProductoDto(fila);
  }

  categorias() {
    return repo.categorias();
  }

  async tiendas() {
    const filas = await repoTienda.activas();
    return filas.map(t => ({
      id: t.id_tienda,
      codigo: t.codigo_tienda,
      nombre: t.nombre_tienda,
      direccion: t.direccion,
      distrito: t.distrito,
      ciudad: t.ciudad,
      telefono: t.telefono_contacto,
      horario: t.horario_atencion,
      tiempoPreparacion: t.tiempo_promedio_preparacion
    }));
  }
}


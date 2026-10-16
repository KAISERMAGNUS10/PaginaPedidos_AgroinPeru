import { aProductoDto, ProductoRepository } from '../repositories/producto.repository';
import { TiendaRepository } from '../repositories/tienda.repository';
import { noEncontrado } from '../utils/errores';
import { texto } from '../utils/validadores';

const repo = new ProductoRepository();
const repoTienda = new TiendaRepository();

export class ProductoService {
  async listar(query: { categoria?: unknown; q?: unknown }) {
    const filas = await repo.listar({
      categoria: texto(query.categoria) || undefined,
      q: texto(query.q) || undefined
    });
    return filas.map(aProductoDto);
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


// El catálogo lo entrega el backend (GET /api/public/productos).
// - Página de inicio: lo pide por páginas (cargarPaginaCatalogo), 12 productos a la vez.
// - Checkout: descarga el catálogo completo una vez (cargarCatalogo) para revisar precios.
import { ProductoCatalogo } from '../../models/producto-catalogo.model';
import { api } from '../utils/api';

export let CATALOGO_AGRO: ProductoCatalogo[] = [];

let cargando: Promise<ProductoCatalogo[]> | null = null;

/** Descarga el catálogo completo (una sola vez por carga de página). */
export function cargarCatalogo(forzar = false): Promise<ProductoCatalogo[]> {
  if (!cargando || forzar) {
    cargando = api
      .get<ProductoCatalogo[]>('/public/productos', undefined, false)
      .then(lista => (CATALOGO_AGRO = lista))
      .catch(error => {
        cargando = null;
        throw error;
      });
  }
  return cargando;
}

export function obtenerProductoCatalogo(id: string): ProductoCatalogo | null {
  return CATALOGO_AGRO.find(producto => producto.id === id) || null;
}

export function obtenerCategoriasCatalogo(): string[] {
  return Array.from(new Set(CATALOGO_AGRO.map(producto => producto.categoria)));
}

/* ------------------------------------------------------------------ */
/* Catálogo por páginas                                                */
/* ------------------------------------------------------------------ */

export type OrdenCatalogo = 'relevancia' | 'precio-asc' | 'precio-desc' | 'nombre';

export interface FiltroCatalogo {
  pagina: number;
  limite: number;
  q: string;
  categorias: string[];
  orden: OrdenCatalogo;
}

export interface PaginaCatalogo {
  productos: ProductoCatalogo[];
  total: number;
  pagina: number;
  paginas: number;
  limite: number;
}

/** Una página del catálogo, ya filtrada y ordenada por el backend. */
export function cargarPaginaCatalogo(f: FiltroCatalogo): Promise<PaginaCatalogo> {
  return api.get<PaginaCatalogo>(
    '/public/productos',
    {
      pagina: f.pagina,
      limite: f.limite,
      q: f.q.trim() || undefined,
      categoria: f.categorias.length ? f.categorias.join(',') : undefined,
      orden: f.orden === 'relevancia' ? undefined : f.orden
    },
    false
  );
}

export interface CategoriaCatalogo {
  nombre: string;
  cantidad: number;
}

let categorias: Promise<CategoriaCatalogo[]> | null = null;

/** Categorías con su cantidad de productos (se piden una sola vez). */
export function cargarCategorias(): Promise<CategoriaCatalogo[]> {
  if (!categorias) {
    categorias = api
      .get<CategoriaCatalogo[]>('/public/categorias', undefined, false)
      .then(lista => lista.filter(c => c.cantidad > 0))
      .catch(error => {
        categorias = null;
        throw error;
      });
  }
  return categorias;
}

/** Un solo producto (página de detalle). */
export function cargarProducto(sku: string): Promise<ProductoCatalogo> {
  return api.get<ProductoCatalogo>(`/public/productos/${encodeURIComponent(sku)}`, undefined, false);
}

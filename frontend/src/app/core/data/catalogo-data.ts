// El catálogo ya NO vive en el frontend: lo entrega el backend (GET /api/public/productos).
// Este módulo lo descarga una vez y lo guarda en memoria para las pantallas de la tienda.
import { ProductoCatalogo } from '../../models/producto-catalogo.model';
import { api } from '../utils/api';

export let CATALOGO_AGRO: ProductoCatalogo[] = [];

let cargando: Promise<ProductoCatalogo[]> | null = null;

/** Descarga el catálogo (una sola vez por carga de página). Llamar antes de pintar la tienda. */
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

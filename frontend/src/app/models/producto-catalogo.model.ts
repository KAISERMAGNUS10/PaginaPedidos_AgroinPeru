/** Producto del catálogo local (core/data/catalogo-data.ts). */
export interface ProductoCatalogo {
  id: string;
  nombre: string;
  nombreCompleto: string;
  categoria: string;
  subcategoria: string;
  medida: string;
  cantidadCaja: number | null;
  cantidadBolsa: number | null;
  precio: number;
  imagen: string;
  descripcion: string;
  descripcionFotografica: string;
}

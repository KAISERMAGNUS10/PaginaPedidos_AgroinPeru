/** Misma forma que ProductoCatalogo del frontend (id = código SKU). */
export interface ProductoDto {
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
  /** Extra: unidades disponibles (tienda + almacén). */
  stock: number;
  disponible: boolean;
}

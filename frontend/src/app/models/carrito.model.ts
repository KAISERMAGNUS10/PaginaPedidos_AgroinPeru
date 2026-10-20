/** Ítem del carrito guardado en localStorage (clave agro_carrito_obj, indexado por id de producto). */
export interface ItemCarrito {
  nombre?: string;
  precio?: number;
  qty?: number;
  cantidad?: number;
  imagen?: string;
  cantidadCaja?: number | null;
  cantidadBolsa?: number | null;
}

export type CarritoObj = Record<string, ItemCarrito>;

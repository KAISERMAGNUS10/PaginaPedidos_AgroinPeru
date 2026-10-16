export type EstadoPedido =
  | 'VIGENTE'
  | 'EN_PREPARACION'
  | 'LISTO_PARA_RECOJO'
  | 'PAGADO'
  | 'ENTREGADO'
  | 'CANCELADO'
  | 'EXPIRADO';

export interface TicketItem {
  id: string;
  nombre: string;
  precio: number;
  cantidad: number;
  subtotal: number;
  medida: string | null;
  cantidadCaja: number | null;
  cantidadBolsa: number | null;
  categoria: string;
  subcategoria: string | null;
  imagen: string | null;
}

export interface PersonaAutorizada {
  nombre: string;
  dni: string;
}

/** Misma forma que `Ticket` del frontend, más algunos campos extra. */
export interface Ticket {
  id: string;
  fechaEmision: string | null;
  fechaExpiracion: string | null;
  cliente: string;
  nombreFacturacion: string;
  documentoTipo: string;
  documentoNumero: string;
  correo: string;
  telefono: string;
  tipoComprobante: 'boleta' | 'factura';
  productos: TicketItem[];
  subtotal: number;
  igv: number;
  total: number;
  estado: EstadoPedido;
  personaAutorizada: PersonaAutorizada | null;

  tienda: {
    id: number;
    nombre: string;
    direccion: string;
    horario: string | null;
  };

  // Los rellenan caja y picking durante el flujo:
  metodoPago?: string;
  montoRecibido?: number;
  vueltoEntregado?: number;
  numOperacion?: string;
  comprobante?: string;
  fechaPago?: string;
  fechaListoParaRecojo?: string;
  fechaEntrega?: string;
  fechaExpirado?: string;
  fechaCancelacion?: string;
}

export interface CheckoutDto {
  tipoComprobante?: string;
  nombreFacturacion?: string;
  cliente?: string;
  documentoTipo?: string;
  documentoNumero?: string;
  correo?: string;
  telefono?: string;
  idTienda?: number;
  /** Opcional: si no se envía, se usa el carrito guardado en la BD. */
  items?: Array<{ id?: string; sku?: string; cantidad?: number; qty?: number }>;
}

export interface PagoDto {
  metodoPago?: string;
  montoRecibido?: number;
  numOperacion?: string;
}

export type EstadoTicket =
  | 'VIGENTE'
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
  categoria: string;
  imagen: string | null;
}

/** Ticket / pedido tal como lo entrega el backend. */
export interface Ticket {
  id: string;
  fechaEmision: string;
  fechaExpiracion: string;
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
  estado: EstadoTicket;
  personaAutorizada: { nombre: string; dni: string } | null;
  tienda: { id: number; nombre: string; direccion: string; horario: string | null };
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

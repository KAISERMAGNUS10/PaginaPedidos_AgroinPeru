import { Component, afterNextRender, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { api, mensajeError } from '../../../core/utils/api';
import { Encabezado } from '../../../shared/encabezado';
import {
  claseEstadoPedido, descargarCsv, diaISO, fechaHora, soles, textoEstadoPedido
} from '../../../shared/formato';
import { Icono } from '../../../shared/icono';
import { Modal } from '../../../shared/modal';

interface Venta {
  id: string;
  comprobante: string;
  tipoComprobante: 'boleta' | 'factura';
  nombreFacturacion: string;
  cliente: string;
  documentoTipo: string;
  documentoNumero: string;
  correo: string;
  telefono: string;
  total: number;
  subtotal: number;
  igv: number;
  estado: string;
  metodoPago: string;
  montoRecibido: number;
  vueltoEntregado: number;
  numOperacion: string;
  fechaEmision: string;
  fechaPago: string;
  fechaListoParaRecojo?: string;
  fechaEntrega?: string;
  personaAutorizada: { nombre: string; dni: string } | null;
  tienda: { nombre: string; direccion: string };
  productos: Array<{ id: string; nombre: string; cantidad: number; precio: number; subtotal: number }>;
}

@Component({
  selector: 'app-ventas',
  imports: [FormsModule, Encabezado, Icono, Modal],
  templateUrl: './ventas.html'
})
export class Ventas {
  protected soles = soles;
  protected fechaHora = fechaHora;
  protected claseEstado = claseEstadoPedido;
  protected textoEstado = textoEstadoPedido;

  protected desde = signal(diaISO(29));
  protected hasta = signal(diaISO(0));
  protected busqueda = signal('');
  protected metodo = signal('');

  protected cargando = signal(true);
  protected error = signal('');
  protected ventas = signal<Venta[]>([]);
  protected detalle = signal<Venta | null>(null);

  protected metodos = computed(() => [...new Set(this.ventas().map(v => v.metodoPago))].filter(Boolean));

  protected visibles = computed(() => {
    const q = this.busqueda().trim().toLowerCase();
    const m = this.metodo();
    return this.ventas().filter(v =>
      (!m || v.metodoPago === m) &&
      (!q || `${v.id} ${v.comprobante} ${v.nombreFacturacion} ${v.documentoNumero}`.toLowerCase().includes(q))
    );
  });

  protected total = computed(() => this.visibles().reduce((a, v) => a + v.total, 0));
  protected promedio = computed(() => (this.visibles().length ? this.total() / this.visibles().length : 0));
  protected unidades = computed(() => this.visibles().reduce((a, v) => a + v.productos.reduce((s, i) => s + i.cantidad, 0), 0));

  constructor() {
    afterNextRender(() => this.cargar());
  }

  protected async cargar(): Promise<void> {
    this.cargando.set(true);
    try {
      const r = await api.get<{ ventas: Venta[] }>('/caja/ventas', { desde: this.desde(), hasta: this.hasta() });
      this.ventas.set(r.ventas);
      this.error.set('');
    } catch (e) {
      this.error.set(mensajeError(e));
    } finally {
      this.cargando.set(false);
    }
  }

  protected exportar(): void {
    descargarCsv(
      `ventas_${this.desde()}_${this.hasta()}`,
      ['Comprobante', 'Ticket', 'Fecha de pago', 'Cliente', 'Documento', 'Tipo', 'Método', 'Subtotal', 'IGV', 'Total', 'Estado'],
      this.visibles().map(v => [
        v.comprobante, v.id, fechaHora(v.fechaPago), v.nombreFacturacion, `${v.documentoTipo} ${v.documentoNumero}`,
        v.tipoComprobante, v.metodoPago, v.subtotal, v.igv, v.total, textoEstadoPedido(v.estado)
      ])
    );
  }

  protected imprimir(): void {
    window.print();
  }
}

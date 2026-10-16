import { Component, OnDestroy, afterNextRender, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Ticket } from '../../../models/ticket.model';
import { api, mensajeError } from '../../../core/utils/api';
import { AgroUI } from '../../../core/utils/agro-ui';
import { Encabezado } from '../../../shared/encabezado';
import {
  claseEstadoPedido, descargarCsv, diaISO, fechaHora, hace, soles, textoEstadoPedido, textoVence
} from '../../../shared/formato';
import { Icono } from '../../../shared/icono';
import { Modal } from '../../../shared/modal';

type Metodo = 'Efectivo' | 'Tarjeta' | 'Yape/Plin';

@Component({
  selector: 'app-caja',
  imports: [FormsModule, Encabezado, Icono, Modal],
  templateUrl: './caja.html'
})
export class Caja implements OnDestroy {
  private temporizador: ReturnType<typeof setInterval> | null = null;

  protected soles = soles;
  protected fechaHora = fechaHora;
  protected hace = hace;
  protected textoVence = textoVence;
  protected claseEstado = claseEstadoPedido;
  protected textoEstado = textoEstadoPedido;

  protected vista = signal<'cobrar' | 'historial'>('cobrar');

  // ------------------------------------------------------------- cobrar
  protected pendientes = signal<Ticket[]>([]);
  protected cargandoCola = signal(true);
  protected errorCola = signal('');

  protected busqueda = signal('');
  protected buscando = signal(false);
  protected resultados = signal<Ticket[] | null>(null);

  protected seleccionado = signal<Ticket | null>(null);
  protected metodo = signal<Metodo>('Efectivo');
  protected recibido = signal<number | null>(null);
  protected operacion = signal('');
  protected procesando = signal(false);
  protected voucher = signal<Ticket | null>(null);

  protected lista = computed(() => this.resultados() ?? this.pendientes());

  protected total = computed(() => this.seleccionado()?.total ?? 0);
  protected vuelto = computed(() => Math.round(((this.recibido() ?? 0) - this.total()) * 100) / 100);
  protected sugerencias = computed(() => {
    const t = this.total();
    if (t <= 0) return [];
    const redondear = (n: number) => Math.ceil(t / n) * n;
    return [...new Set([Math.round(t * 100) / 100, redondear(10), redondear(50), redondear(100), redondear(200)])].sort((a, b) => a - b);
  });
  protected puedeCobrar = computed(() => {
    const t = this.seleccionado();
    if (!t || t.estado !== 'LISTO_PARA_RECOJO' || this.procesando()) return false;
    return this.metodo() !== 'Efectivo' || (this.recibido() ?? 0) >= t.total;
  });

  // ---------------------------------------------------------- historial
  protected desde = signal(diaISO(0));
  protected hasta = signal(diaISO(0));
  protected ventas = signal<Ticket[]>([]);
  protected cargandoVentas = signal(false);
  protected detalle = signal<Ticket | null>(null);
  protected totalVentas = computed(() => this.ventas().reduce((a, v) => a + v.total, 0));

  constructor() {
    afterNextRender(() => {
      this.cargarCola();
      // La cola se actualiza sola cada 15 s (llegan pedidos que almacén deja listos).
      this.temporizador = setInterval(() => this.cargarCola(false), 15000);
    });
  }

  ngOnDestroy(): void {
    if (this.temporizador) clearInterval(this.temporizador);
  }

  // --------------------------------------------------------------- cola
  protected async cargarCola(spinner = true): Promise<void> {
    if (spinner) this.cargandoCola.set(true);
    try {
      this.pendientes.set(await api.get<Ticket[]>('/caja/pendientes'));
      this.errorCola.set('');

      // Si el ticket abierto ya no está por cobrar (p. ej. venció), se refresca su estado.
      const sel = this.seleccionado();
      if (sel && sel.estado === 'LISTO_PARA_RECOJO' && !this.pendientes().some(t => t.id === sel.id)) {
        await this.refrescarSeleccionado();
      }
    } catch (e) {
      this.errorCola.set(mensajeError(e));
    } finally {
      this.cargandoCola.set(false);
    }
  }

  private async refrescarSeleccionado(): Promise<void> {
    const sel = this.seleccionado();
    if (!sel) return;
    try {
      const lista = await api.get<Ticket[]>('/caja/buscar', { q: sel.id });
      if (lista[0]) this.seleccionado.set(lista[0]);
    } catch { /* se mantiene lo que había */ }
  }

  protected async buscar(): Promise<void> {
    const q = this.busqueda().trim();
    if (!q) {
      this.resultados.set(null);
      return;
    }
    this.buscando.set(true);
    try {
      const r = await api.get<Ticket[]>('/caja/buscar', { q });
      this.resultados.set(r);
      if (r.length === 0) {
        AgroUI.toast('No se encontró ningún ticket con ese dato.', 'warning', 'Sin resultados');
      } else if (r.length === 1) {
        this.seleccionar(r[0]);
      }
    } catch (e) {
      AgroUI.toast(mensajeError(e), 'error');
    } finally {
      this.buscando.set(false);
    }
  }

  protected limpiarBusqueda(): void {
    this.busqueda.set('');
    this.resultados.set(null);
  }

  protected seleccionar(t: Ticket): void {
    this.seleccionado.set(t);
    this.metodo.set('Efectivo');
    this.recibido.set(null);
    this.operacion.set('');
  }

  protected elegirMetodo(m: Metodo): void {
    this.metodo.set(m);
    this.recibido.set(m === 'Efectivo' ? null : this.total());
  }

  protected cantidadItems(t: Ticket): number {
    return t.productos.reduce((a, p) => a + p.cantidad, 0);
  }

  protected mensajeEstado(t: Ticket): string {
    switch (t.estado) {
      case 'VIGENTE': return 'Este pedido todavía está siendo preparado en almacén. Podrás cobrarlo cuando aparezca como "Listo para recojo".';
      case 'PAGADO': return 'Este pedido ya fue cobrado. Está esperando que almacén lo entregue.';
      case 'ENTREGADO': return 'Este pedido ya fue cobrado y entregado.';
      case 'CANCELADO': return 'El cliente canceló este pedido. No puede cobrarse.';
      case 'EXPIRADO': return 'Este ticket venció (superó las 48 horas) y ya no puede cobrarse.';
      default: return '';
    }
  }

  protected async cobrar(): Promise<void> {
    const t = this.seleccionado();
    if (!t || !this.puedeCobrar()) return;

    this.procesando.set(true);
    try {
      const pagado = await api.post<Ticket>(`/caja/pedidos/${encodeURIComponent(t.id)}/pagar`, {
        metodoPago: this.metodo(),
        montoRecibido: this.metodo() === 'Efectivo' ? this.recibido() : t.total,
        numOperacion: this.operacion().trim()
      });
      this.voucher.set(pagado);
      this.seleccionado.set(null);
      this.resultados.set(null);
      this.busqueda.set('');
      await this.cargarCola(false);
    } catch (e) {
      AgroUI.toast(mensajeError(e), 'error', 'No se pudo registrar el pago');
      await this.refrescarSeleccionado();
      await this.cargarCola(false);
    } finally {
      this.procesando.set(false);
    }
  }

  protected imprimir(): void {
    window.print();
  }

  // ----------------------------------------------------------- historial
  protected verHistorial(): void {
    this.vista.set('historial');
    this.cargarVentas();
  }

  protected async cargarVentas(): Promise<void> {
    this.cargandoVentas.set(true);
    try {
      const r = await api.get<{ ventas: Ticket[] }>('/caja/ventas', { desde: this.desde(), hasta: this.hasta() });
      this.ventas.set(r.ventas);
    } catch (e) {
      AgroUI.toast(mensajeError(e), 'error');
    } finally {
      this.cargandoVentas.set(false);
    }
  }

  protected exportar(): void {
    descargarCsv(
      `caja_${this.desde()}_${this.hasta()}`,
      ['Comprobante', 'Ticket', 'Fecha', 'Cliente', 'Documento', 'Método', 'Total'],
      this.ventas().map(v => [v.comprobante, v.id, fechaHora(v.fechaPago), v.nombreFacturacion, `${v.documentoTipo} ${v.documentoNumero}`, v.metodoPago, v.total])
    );
  }
}

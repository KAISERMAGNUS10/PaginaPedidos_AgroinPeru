import { Component, OnDestroy, afterNextRender, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Ticket } from '../../../models/ticket.model';
import { api, mensajeError } from '../../../core/utils/api';
import { AgroUI } from '../../../core/utils/agro-ui';
import { Encabezado } from '../../../shared/encabezado';
import { descargarCsv, diaISO, fechaHora, hace, horasRestantes, soles, textoVence } from '../../../shared/formato';
import { Icono } from '../../../shared/icono';
import { Modal } from '../../../shared/modal';

type Pestana = 'preparar' | 'entregar' | 'historial';

interface Historial {
  totalPedidos: number;
  totalUnidades: number;
  pedidos: Ticket[];
}

@Component({
  selector: 'app-picking',
  imports: [FormsModule, Encabezado, Icono, Modal],
  templateUrl: './picking.html'
})
export class Picking implements OnDestroy {
  private temporizador: ReturnType<typeof setInterval> | null = null;
  /** Ítems ya separados por pedido (se conserva al cerrar y volver a abrir el panel). */
  private progreso = new Map<string, Set<string>>();

  protected soles = soles;
  protected fechaHora = fechaHora;
  protected hace = hace;
  protected textoVence = textoVence;

  protected pestana = signal<Pestana>('preparar');
  protected cargando = signal(true);
  protected error = signal('');
  protected pendientes = signal<Ticket[]>([]);
  protected porEntregar = signal<Ticket[]>([]);

  // --- panel de preparación ---
  protected abierto = signal<Ticket | null>(null);
  protected marcados = signal<Set<string>>(new Set());
  protected procesando = signal(false);

  protected total = computed(() => this.abierto()?.productos.length ?? 0);
  protected hechos = computed(() => this.marcados().size);
  protected pct = computed(() => (this.total() ? Math.round((this.hechos() / this.total()) * 100) : 0));
  protected completo = computed(() => this.total() > 0 && this.hechos() === this.total());

  // --- entrega ---
  protected porConfirmar = signal<Ticket | null>(null);

  // --- historial ---
  protected desde = signal(diaISO(6));
  protected hasta = signal(diaISO(0));
  protected historial = signal<Historial | null>(null);
  protected cargandoHist = signal(false);
  protected detalleHist = signal<Ticket | null>(null);

  constructor() {
    afterNextRender(() => {
      this.cargar();
      this.temporizador = setInterval(() => this.cargar(false), 15000);
    });
  }

  ngOnDestroy(): void {
    if (this.temporizador) clearInterval(this.temporizador);
  }

  // ----------------------------------------------------------------- datos
  protected async cargar(spinner = true): Promise<void> {
    if (spinner) this.cargando.set(true);
    try {
      const [pend, ent] = await Promise.all([
        api.get<Ticket[]>('/picking/pendientes'),
        api.get<Ticket[]>('/picking/por-entregar')
      ]);
      this.pendientes.set(pend);
      this.porEntregar.set(ent);
      this.error.set('');

      // Si el pedido abierto ya no está pendiente (lo canceló el cliente o venció), se cierra el panel.
      const a = this.abierto();
      if (a && !pend.some(t => t.id === a.id)) {
        this.abierto.set(null);
        AgroUI.toast(`El pedido ${a.id} ya no está disponible (cancelado o vencido).`, 'warning');
      }
    } catch (e) {
      this.error.set(mensajeError(e));
    } finally {
      this.cargando.set(false);
    }
  }

  protected cantidadItems(t: Ticket): number {
    return t.productos.reduce((a, p) => a + p.cantidad, 0);
  }

  protected urgente(t: Ticket): boolean {
    return horasRestantes(t.fechaExpiracion) < 12;
  }

  protected avance(t: Ticket): number {
    return this.progreso.get(t.id)?.size ?? 0;
  }

  protected imagenRota(ev: Event): void {
    (ev.target as HTMLImageElement).src = 'img/logoagroperu.jpg';
  }

  // ----------------------------------------------------------- preparación
  protected abrir(t: Ticket): void {
    this.abierto.set(t);
    this.marcados.set(new Set(this.progreso.get(t.id) ?? []));
  }

  protected cerrar(): void {
    this.abierto.set(null);
  }

  protected alternar(sku: string): void {
    const t = this.abierto();
    if (!t) return;
    const nuevo = new Set(this.marcados());
    if (nuevo.has(sku)) nuevo.delete(sku); else nuevo.add(sku);
    this.marcados.set(nuevo);
    this.progreso.set(t.id, nuevo);

    // Se guarda el avance en el servidor (no bloquea la pantalla si falla).
    api.patch(`/picking/pedidos/${encodeURIComponent(t.id)}/progreso`, { items: nuevo.size }).catch(() => {});
  }

  protected marcarTodo(): void {
    const t = this.abierto();
    if (!t) return;
    const todos = new Set(t.productos.map(p => p.id));
    this.marcados.set(todos);
    this.progreso.set(t.id, todos);
    api.patch(`/picking/pedidos/${encodeURIComponent(t.id)}/progreso`, { items: todos.size }).catch(() => {});
  }

  protected async marcarListo(): Promise<void> {
    const t = this.abierto();
    if (!t || !this.completo()) return;

    this.procesando.set(true);
    try {
      await api.post(`/picking/pedidos/${encodeURIComponent(t.id)}/listo`);
      this.progreso.delete(t.id);
      this.abierto.set(null);
      AgroUI.toast(`Pedido ${t.id} listo para recojo. El cliente fue notificado y puede pasar por caja.`, 'success', 'Pedido preparado');
      await this.cargar(false);
    } catch (e) {
      AgroUI.toast(mensajeError(e), 'error', 'No se pudo completar');
      await this.cargar(false);
    } finally {
      this.procesando.set(false);
    }
  }

  // --------------------------------------------------------------- entrega
  protected async entregar(): Promise<void> {
    const t = this.porConfirmar();
    if (!t) return;

    this.procesando.set(true);
    try {
      await api.post(`/picking/pedidos/${encodeURIComponent(t.id)}/entregar`);
      this.porConfirmar.set(null);
      AgroUI.toast(`Pedido ${t.id} entregado correctamente.`, 'success', 'Entrega registrada');
      await this.cargar(false);
    } catch (e) {
      AgroUI.toast(mensajeError(e), 'error', 'No se pudo registrar la entrega');
      this.porConfirmar.set(null);
      await this.cargar(false);
    } finally {
      this.procesando.set(false);
    }
  }

  // ------------------------------------------------------------- historial
  protected verHistorial(): void {
    this.pestana.set('historial');
    this.cargarHistorial();
  }

  protected async cargarHistorial(): Promise<void> {
    this.cargandoHist.set(true);
    try {
      this.historial.set(await api.get<Historial>('/picking/historial', { desde: this.desde(), hasta: this.hasta() }));
    } catch (e) {
      AgroUI.toast(mensajeError(e), 'error');
    } finally {
      this.cargandoHist.set(false);
    }
  }

  protected exportar(): void {
    const h = this.historial();
    if (!h) return;
    descargarCsv(
      `entregas_${this.desde()}_${this.hasta()}`,
      ['Ticket', 'Cliente', 'Documento', 'Unidades', 'Recogió', 'Fecha de entrega'],
      h.pedidos.map(t => [
        t.id, t.nombreFacturacion, `${t.documentoTipo} ${t.documentoNumero}`, this.cantidadItems(t),
        t.personaAutorizada ? `${t.personaAutorizada.nombre} (DNI ${t.personaAutorizada.dni})` : 'Titular', fechaHora(t.fechaEntrega)
      ])
    );
  }

  protected imprimir(): void {
    window.print();
  }
}

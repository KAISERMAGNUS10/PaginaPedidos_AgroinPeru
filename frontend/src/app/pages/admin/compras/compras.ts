import { Component, afterNextRender, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { api, mensajeError } from '../../../core/utils/api';
import { AgroUI } from '../../../core/utils/agro-ui';
import { Confirmacion } from '../../../shared/confirmacion';
import { Encabezado } from '../../../shared/encabezado';
import { descargarCsv, diaISO, fechaHora, numero, soles } from '../../../shared/formato';
import { Icono } from '../../../shared/icono';
import { Modal } from '../../../shared/modal';

interface CompraFila {
  id: string;
  proveedor: string;
  ruc: string | null;
  tipoComprobante: string;
  numeroComprobante: string | null;
  ubicacion: 'TIENDA' | 'ALMACEN';
  subtotal: number;
  igv: number;
  total: number;
  estado: 'REGISTRADA' | 'ANULADA';
  observaciones: string | null;
  fecha: string;
  fechaAnulacion: string | null;
  usuario: string;
  items: number;
  unidades: number;
  productos?: Array<{ id: string; nombre: string; cantidad: number; costoUnitario: number; subtotal: number }>;
}

interface ProductoLista { id: string; nombre: string; categoria: string; stockTotal: number; precio: number; }
interface ItemCompra { id: string; nombre: string; cantidad: number; costo: number; }

@Component({
  selector: 'app-compras',
  imports: [FormsModule, Encabezado, Icono, Modal],
  templateUrl: './compras.html'
})
export class Compras {
  private confirmacion = inject(Confirmacion);

  protected soles = soles;
  protected numero = numero;
  protected fechaHora = fechaHora;

  protected desde = signal(diaISO(29));
  protected hasta = signal(diaISO(0));
  protected busqueda = signal('');
  protected estado = signal('');

  protected cargando = signal(true);
  protected error = signal('');
  protected compras = signal<CompraFila[]>([]);
  protected resumen = signal({ cantidad: 0, total: 0 });

  // --- detalle ---
  protected detalle = signal<CompraFila | null>(null);

  // --- nueva compra ---
  protected modalNueva = signal(false);
  protected guardando = signal(false);
  protected errorForm = signal('');
  protected catalogo = signal<ProductoLista[]>([]);
  protected items = signal<ItemCompra[]>([]);
  protected buscarProd = signal('');
  protected f = this.formVacio();

  protected resultados = computed(() => {
    const q = this.buscarProd().trim().toLowerCase();
    if (q.length < 2) return [];
    const usados = new Set(this.items().map(i => i.id));
    return this.catalogo().filter(p => !usados.has(p.id) && `${p.nombre} ${p.id}`.toLowerCase().includes(q)).slice(0, 8);
  });

  protected subtotal = computed(() => Math.round(this.items().reduce((a, i) => a + i.cantidad * i.costo, 0) * 100) / 100);
  protected igv = computed(() => Math.round(this.subtotal() * 18) / 100);
  protected total = computed(() => Math.round((this.subtotal() + this.igv()) * 100) / 100);
  protected unidades = computed(() => this.items().reduce((a, i) => a + i.cantidad, 0));

  constructor() {
    afterNextRender(() => this.cargar());
  }

  private formVacio() {
    return { proveedor: '', ruc: '', tipoComprobante: 'FACTURA', numeroComprobante: '', ubicacion: 'ALMACEN', observaciones: '' };
  }

  protected async cargar(): Promise<void> {
    this.cargando.set(true);
    try {
      const r = await api.get<{ cantidad: number; total: number; compras: CompraFila[] }>('/compras', {
        desde: this.desde(), hasta: this.hasta(), estado: this.estado(), q: this.busqueda()
      });
      this.compras.set(r.compras);
      this.resumen.set({ cantidad: r.cantidad, total: r.total });
      this.error.set('');
    } catch (e) {
      this.error.set(mensajeError(e));
    } finally {
      this.cargando.set(false);
    }
  }

  protected async verDetalle(c: CompraFila): Promise<void> {
    try {
      this.detalle.set(await api.get<CompraFila>(`/compras/${encodeURIComponent(c.id)}`));
    } catch (e) {
      AgroUI.toast(mensajeError(e), 'error');
    }
  }

  protected async anular(c: CompraFila): Promise<void> {
    const ok = await this.confirmacion.preguntar(
      `Se anulará la compra ${c.id} y se RESTARÁN del ${c.ubicacion === 'ALMACEN' ? 'almacén' : 'stock de tienda'} las ${c.unidades} unidades que ingresó. Solo es posible si todavía hay stock suficiente.`,
      { titulo: 'Anular compra', textoOk: 'Anular compra', peligro: true }
    );
    if (!ok) return;

    try {
      await api.patch(`/compras/${encodeURIComponent(c.id)}/anular`);
      AgroUI.toast('Compra anulada y stock revertido.', 'success');
      this.detalle.set(null);
      await this.cargar();
    } catch (e) {
      AgroUI.toast(mensajeError(e), 'error', 'No se pudo anular');
    }
  }

  // ------------------------------------------------------------ nueva compra
  protected async nueva(): Promise<void> {
    this.f = this.formVacio();
    this.items.set([]);
    this.buscarProd.set('');
    this.errorForm.set('');
    this.modalNueva.set(true);

    if (this.catalogo().length === 0) {
      try {
        this.catalogo.set(await api.get<ProductoLista[]>('/inventario'));
      } catch (e) {
        this.errorForm.set(mensajeError(e));
      }
    }
  }

  protected agregarProducto(p: ProductoLista): void {
    this.items.update(l => [...l, { id: p.id, nombre: p.nombre, cantidad: 1, costo: 0 }]);
    this.buscarProd.set('');
  }

  protected setCantidad(i: number, v: unknown): void {
    this.items.update(l => l.map((it, idx) => (idx === i ? { ...it, cantidad: Math.max(0, Math.floor(Number(v) || 0)) } : it)));
  }

  protected setCosto(i: number, v: unknown): void {
    this.items.update(l => l.map((it, idx) => (idx === i ? { ...it, costo: Math.max(0, Number(v) || 0) } : it)));
  }

  protected quitarItem(i: number): void {
    this.items.update(l => l.filter((_, idx) => idx !== i));
  }

  protected async guardar(): Promise<void> {
    this.errorForm.set('');
    if (this.items().length === 0) { this.errorForm.set('Agrega al menos un producto.'); return; }
    if (this.items().some(i => i.cantidad <= 0)) { this.errorForm.set('Todas las cantidades deben ser mayores a 0.'); return; }

    this.guardando.set(true);
    try {
      const r = await api.post<CompraFila>('/compras', {
        proveedor: this.f.proveedor, ruc: this.f.ruc, tipoComprobante: this.f.tipoComprobante,
        numeroComprobante: this.f.numeroComprobante, ubicacion: this.f.ubicacion, observaciones: this.f.observaciones,
        items: this.items().map(i => ({ id: i.id, cantidad: i.cantidad, costoUnitario: i.costo }))
      });
      AgroUI.toast(`Compra ${r.id} registrada. El stock fue actualizado.`, 'success');
      this.modalNueva.set(false);
      await this.cargar();
    } catch (e) {
      this.errorForm.set(mensajeError(e));
    } finally {
      this.guardando.set(false);
    }
  }

  protected exportar(): void {
    descargarCsv(
      `compras_${this.desde()}_${this.hasta()}`,
      ['Código', 'Fecha', 'Proveedor', 'RUC', 'Comprobante', 'N° comprobante', 'Destino', 'Unidades', 'Subtotal', 'IGV', 'Total', 'Estado'],
      this.compras().map(c => [c.id, fechaHora(c.fecha), c.proveedor, c.ruc, c.tipoComprobante, c.numeroComprobante, c.ubicacion, c.unidades, c.subtotal, c.igv, c.total, c.estado])
    );
  }
}

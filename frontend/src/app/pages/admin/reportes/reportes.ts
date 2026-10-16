import { Component, afterNextRender, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { api, mensajeError } from '../../../core/utils/api';
import { Encabezado } from '../../../shared/encabezado';
import { descargarCsv, diaISO, etiquetaMetodo, numero, plural, soles, solesCorto, textoEstadoPedido } from '../../../shared/formato';
import { BarrasLista, GraficoBarras, GraficoLinea, PuntoGrafico } from '../../../shared/graficos';
import { Icono } from '../../../shared/icono';

@Component({
  selector: 'app-reportes',
  imports: [FormsModule, Encabezado, Icono, GraficoLinea, GraficoBarras, BarrasLista],
  templateUrl: './reportes.html'
})
export class Reportes {
  protected soles = soles;
  protected plural = plural;
  protected solesCorto = solesCorto;
  protected numero = numero;
  protected unidadesFmt = (v: number) => numero(v) + ' u.';
  protected cantFmt = (v: number) => numero(v);

  protected desde = signal(diaISO(29));
  protected hasta = signal(diaISO(0));
  protected preset = signal<'7' | '30' | '90' | 'mes' | 'custom'>('30');

  protected cargando = signal(true);
  protected error = signal('');
  protected r = signal<any>(null);

  private etiqueta(f: string): string {
    return f.slice(8, 10) + '/' + f.slice(5, 7);
  }

  protected ventasDia = computed<PuntoGrafico[]>(() =>
    (this.r()?.ventas.porDia ?? []).map((d: any) => ({ etiqueta: this.etiqueta(d.fecha), valor: d.total }))
  );
  protected comprasDia = computed<PuntoGrafico[]>(() =>
    (this.r()?.compras.porDia ?? []).map((d: any) => ({ etiqueta: this.etiqueta(d.fecha), valor: d.total }))
  );
  protected metodos = computed<PuntoGrafico[]>(() =>
    (this.r()?.ventas.porMetodo ?? []).map((m: any) => ({ etiqueta: `${etiquetaMetodo(m.metodo)} (${m.cantidad})`, valor: m.total }))
  );
  protected comprobantes = computed<PuntoGrafico[]>(() =>
    (this.r()?.ventas.porComprobante ?? []).map((m: any) => ({ etiqueta: `${m.tipo === 'FACTURA' ? 'Facturas' : 'Boletas'} (${m.cantidad})`, valor: m.total }))
  );
  protected categorias = computed<PuntoGrafico[]>(() =>
    (this.r()?.productos.porCategoria ?? []).map((c: any) => ({ etiqueta: c.categoria, valor: c.total }))
  );
  protected estados = computed(() =>
    Object.entries(this.r()?.pedidos.porEstado ?? {}).map(([e, n]) => ({ etiqueta: textoEstadoPedido(e), valor: n as number }))
  );
  protected balance = computed(() => (this.r() ? this.r().ventas.total - this.r().compras.total : 0));

  constructor() {
    afterNextRender(() => this.cargar());
  }

  protected elegir(p: '7' | '30' | '90' | 'mes'): void {
    this.preset.set(p);
    this.hasta.set(diaISO(0));
    if (p === 'mes') {
      const hoy = new Date();
      this.desde.set(`${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-01`);
    } else {
      this.desde.set(diaISO(Number(p) - 1));
    }
    this.cargar();
  }

  protected manual(): void {
    this.preset.set('custom');
    this.cargar();
  }

  protected async cargar(): Promise<void> {
    this.cargando.set(true);
    try {
      this.r.set(await api.get('/reportes', { desde: this.desde(), hasta: this.hasta() }));
      this.error.set('');
    } catch (e) {
      this.error.set(mensajeError(e));
    } finally {
      this.cargando.set(false);
    }
  }

  protected exportarVentas(): void {
    const d = this.r();
    if (!d) return;
    descargarCsv(
      `reporte_ventas_${d.rango.desde}_${d.rango.hasta}`,
      ['Fecha', 'N° de ventas', 'Total vendido'],
      d.ventas.porDia.map((x: any) => [x.fecha, x.cantidad, x.total])
    );
  }

  protected exportarProductos(): void {
    const d = this.r();
    if (!d) return;
    descargarCsv(
      `productos_mas_vendidos_${d.rango.desde}_${d.rango.hasta}`,
      ['SKU', 'Producto', 'Categoría', 'Unidades vendidas', 'Total vendido'],
      d.productos.masVendidos.map((p: any) => [p.sku, p.nombre, p.categoria, p.unidades, p.total])
    );
  }

  protected imprimir(): void {
    window.print();
  }
}

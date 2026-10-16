import { Component, OnDestroy, afterNextRender, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { api, mensajeError } from '../../../core/utils/api';
import { AgroUI } from '../../../core/utils/agro-ui';
import { Confirmacion } from '../../../shared/confirmacion';
import { Encabezado } from '../../../shared/encabezado';
import { diaISO, fechaHora, hace, numero, plural, soles } from '../../../shared/formato';
import { GraficoLinea, PuntoGrafico } from '../../../shared/graficos';
import { Icono } from '../../../shared/icono';

const COLOR_ACTIVIDAD: Record<string, string> = {
  PEDIDO: '#00a3e0', LISTO: '#f59e0b', PAGO: '#16a34a', ENTREGA: '#7c3aed', EXPIRADO: '#94a3b8', CANCELADO: '#e11d2e'
};

@Component({
  selector: 'app-dashboard',
  imports: [FormsModule, RouterLink, Encabezado, Icono, GraficoLinea],
  templateUrl: './dashboard.html'
})
export class Dashboard implements OnDestroy {
  private confirmacion = inject(Confirmacion);
  private temporizador: ReturnType<typeof setInterval> | null = null;

  protected soles = soles;
  protected numero = numero;
  protected plural = plural;
  protected fechaHora = fechaHora;
  protected hace = hace;

  protected cargando = signal(true);
  protected error = signal('');
  protected datos = signal<any>(null);
  protected desde = signal(diaISO(29));
  protected hasta = signal(diaISO(0));
  protected preset = signal<'hoy' | '7' | '30' | 'custom'>('30');

  protected grafico = computed<PuntoGrafico[]>(() =>
    (this.datos()?.ventasUltimos7Dias ?? []).map((d: any) => ({
      etiqueta: d.fecha.slice(8, 10) + '/' + d.fecha.slice(5, 7),
      valor: d.total
    }))
  );
  protected total7 = computed(() => this.grafico().reduce((a, p) => a + p.valor, 0));
  protected ultimasVentas = computed(() => (this.datos()?.ventas ?? []).slice(0, 7));
  protected topClientes = computed(() =>
    [...(this.datos()?.clientes ?? [])].sort((a: any, b: any) => b.valorPedidos - a.valorPedidos).slice(0, 5)
  );

  constructor() {
    afterNextRender(() => {
      this.cargar();
      this.temporizador = setInterval(() => this.cargar(false), 60000);
    });
  }

  ngOnDestroy(): void {
    if (this.temporizador) clearInterval(this.temporizador);
  }

  protected colorActividad(tipo: string): string {
    return COLOR_ACTIVIDAD[tipo] ?? '#94a3b8';
  }

  protected elegir(p: 'hoy' | '7' | '30'): void {
    this.preset.set(p);
    this.hasta.set(diaISO(0));
    this.desde.set(p === 'hoy' ? diaISO(0) : p === '7' ? diaISO(6) : diaISO(29));
    this.cargar();
  }

  protected cambioManual(): void {
    this.preset.set('custom');
    this.cargar();
  }

  protected async cargar(mostrarSpinner = true): Promise<void> {
    if (mostrarSpinner) this.cargando.set(true);
    try {
      this.datos.set(await api.get('/dashboard', { desde: this.desde(), hasta: this.hasta() }));
      this.error.set('');
    } catch (e) {
      this.error.set(mensajeError(e));
    } finally {
      this.cargando.set(false);
    }
  }

  protected async reiniciar(): Promise<void> {
    const ok = await this.confirmacion.preguntar(
      'Se borrarán TODOS los pedidos, pagos, carritos y notificaciones, y se devolverá el stock reservado. Los usuarios, productos y compras se conservan. Esta acción no se puede deshacer.',
      { titulo: 'Reiniciar datos de demostración', textoOk: 'Sí, reiniciar', peligro: true }
    );
    if (!ok) return;
    try {
      await api.post('/dashboard/reiniciar-demo', { confirmar: true });
      AgroUI.toast('Datos operativos reiniciados.', 'success');
      this.cargar();
    } catch (e) {
      AgroUI.toast(mensajeError(e), 'error');
    }
  }
}

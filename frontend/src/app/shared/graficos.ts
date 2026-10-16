import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { soles } from './formato';

export interface PuntoGrafico {
  etiqueta: string;
  valor: number;
}

function nice(max: number): number {
  if (max <= 0) return 10;
  const exp = Math.pow(10, Math.floor(Math.log10(max)));
  const n = max / exp;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * exp;
}

/** Gráfico de área/línea (ventas por día). */
@Component({
  selector: 'ap-grafico-linea',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ap-grafico">
      <svg [attr.viewBox]="'0 0 ' + W + ' ' + H" role="img" aria-label="Gráfico de línea">
        <defs>
          <linearGradient [attr.id]="id" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" [attr.stop-color]="color()" stop-opacity=".30" />
            <stop offset="100%" [attr.stop-color]="color()" stop-opacity="0" />
          </linearGradient>
        </defs>
        @for (g of rejilla(); track g.y) {
          <line [attr.x1]="padL" [attr.x2]="W - padR" [attr.y1]="g.y" [attr.y2]="g.y" stroke="#e2e8f0" stroke-dasharray="3 4" />
          <text [attr.x]="padL - 8" [attr.y]="g.y + 4" text-anchor="end">{{ g.texto }}</text>
        }
        @if (area()) { <path [attr.d]="area()" [attr.fill]="'url(#' + id + ')'" /> }
        @if (linea()) { <path [attr.d]="linea()" fill="none" [attr.stroke]="color()" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" /> }
        @for (p of puntos(); track p.i) {
          <circle [attr.cx]="p.x" [attr.cy]="p.y" r="3.6" fill="#fff" [attr.stroke]="color()" stroke-width="2">
            <title>{{ p.etiqueta }}: {{ p.texto }}</title>
          </circle>
        }
        @for (e of etiquetasX(); track e.i) {
          <text [attr.x]="e.x" [attr.y]="H - 8" text-anchor="middle">{{ e.texto }}</text>
        }
      </svg>
    </div>
  `
})
export class GraficoLinea {
  datos = input.required<PuntoGrafico[]>();
  color = input('#0f4782');
  formato = input<(v: number) => string>(soles);

  protected readonly W = 720;
  protected readonly H = 260;
  protected readonly padL = 64;
  protected readonly padR = 16;
  protected readonly padT = 14;
  protected readonly padB = 32;
  protected readonly id = 'gl' + Math.random().toString(36).slice(2, 8);

  private max = computed(() => nice(Math.max(0, ...this.datos().map(d => d.valor)) * 1.05));

  protected puntos = computed(() => {
    const d = this.datos();
    const w = this.W - this.padL - this.padR;
    const h = this.H - this.padT - this.padB;
    const f = this.formato();
    return d.map((p, i) => ({
      i,
      etiqueta: p.etiqueta,
      texto: f(p.valor),
      x: this.padL + (d.length === 1 ? w / 2 : (w * i) / (d.length - 1)),
      y: this.padT + h - (p.valor / this.max()) * h
    }));
  });

  protected linea = computed(() => {
    const p = this.puntos();
    return p.length ? 'M' + p.map(q => `${q.x},${q.y}`).join(' L') : '';
  });

  protected area = computed(() => {
    const p = this.puntos();
    if (!p.length) return '';
    const base = this.H - this.padB;
    return `M${p[0].x},${base} L` + p.map(q => `${q.x},${q.y}`).join(' L') + ` L${p[p.length - 1].x},${base} Z`;
  });

  protected rejilla = computed(() => {
    const h = this.H - this.padT - this.padB;
    const f = this.formato();
    return [0, 1, 2, 3, 4].map(i => ({
      y: this.padT + h - (h * i) / 4,
      texto: f((this.max() * i) / 4).replace('S/ ', '').replace(/\.00$/, '')
    }));
  });

  protected etiquetasX = computed(() => {
    const p = this.puntos();
    const paso = Math.max(1, Math.ceil(p.length / 8));
    return p.filter((_, i) => i % paso === 0).map(q => ({ i: q.i, x: q.x, texto: q.etiqueta }));
  });
}

/** Gráfico de barras verticales. */
@Component({
  selector: 'ap-grafico-barras',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ap-grafico">
      <svg [attr.viewBox]="'0 0 ' + W + ' ' + H" role="img" aria-label="Gráfico de barras">
        @for (g of rejilla(); track g.y) {
          <line [attr.x1]="padL" [attr.x2]="W - padR" [attr.y1]="g.y" [attr.y2]="g.y" stroke="#e2e8f0" stroke-dasharray="3 4" />
          <text [attr.x]="padL - 8" [attr.y]="g.y + 4" text-anchor="end">{{ g.texto }}</text>
        }
        @for (b of barras(); track b.i) {
          <rect [attr.x]="b.x" [attr.y]="b.y" [attr.width]="b.w" [attr.height]="b.h" rx="5" [attr.fill]="color()" opacity=".92">
            <title>{{ b.etiqueta }}: {{ b.texto }}</title>
          </rect>
          @if (b.mostrar) { <text [attr.x]="b.x + b.w / 2" [attr.y]="H - 8" text-anchor="middle">{{ b.corta }}</text> }
        }
      </svg>
    </div>
  `
})
export class GraficoBarras {
  datos = input.required<PuntoGrafico[]>();
  color = input('#00a3e0');
  formato = input<(v: number) => string>(soles);

  protected readonly W = 720;
  protected readonly H = 240;
  protected readonly padL = 64;
  protected readonly padR = 16;
  protected readonly padT = 14;
  protected readonly padB = 32;

  private max = computed(() => nice(Math.max(0, ...this.datos().map(d => d.valor)) * 1.05));

  protected barras = computed(() => {
    const d = this.datos();
    const w = this.W - this.padL - this.padR;
    const h = this.H - this.padT - this.padB;
    const ancho = w / Math.max(d.length, 1);
    const f = this.formato();
    const paso = Math.max(1, Math.ceil(d.length / 8));
    return d.map((p, i) => {
      const alto = (p.valor / this.max()) * h;
      const bw = Math.min(ancho * 0.62, 56);
      return {
        mostrar: i % paso === 0,
        i, etiqueta: p.etiqueta, texto: f(p.valor), corta: p.etiqueta.length > 9 ? p.etiqueta.slice(0, 8) + '…' : p.etiqueta,
        x: this.padL + ancho * i + (ancho - bw) / 2, w: bw, h: Math.max(alto, p.valor > 0 ? 2 : 0),
        y: this.padT + h - alto
      };
    });
  });

  protected rejilla = computed(() => {
    const h = this.H - this.padT - this.padB;
    const f = this.formato();
    return [0, 1, 2, 3, 4].map(i => ({
      y: this.padT + h - (h * i) / 4,
      texto: f((this.max() * i) / 4).replace('S/ ', '').replace(/\.00$/, '')
    }));
  });
}

/** Lista de barras horizontales (ranking / participación). */
@Component({
  selector: 'ap-barras-lista',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (f of filas(); track f.etiqueta) {
      <div class="ap-barra-fila">
        <span class="nombre" [title]="f.etiqueta">{{ f.etiqueta }}</span>
        <span class="valor">{{ f.texto }}</span>
        <div class="ap-barra-pista"><div class="ap-barra-relleno" [style.width.%]="f.pct"></div></div>
      </div>
    } @empty {
      <div class="ap-vacio" style="padding: 20px">Sin datos en este periodo.</div>
    }
  `
})
export class BarrasLista {
  datos = input.required<PuntoGrafico[]>();
  formato = input<(v: number) => string>(soles);

  protected filas = computed(() => {
    const max = Math.max(1, ...this.datos().map(d => d.valor));
    const f = this.formato();
    return this.datos().map(d => ({ etiqueta: d.etiqueta, texto: f(d.valor), pct: Math.max(2, (d.valor / max) * 100) }));
  });
}

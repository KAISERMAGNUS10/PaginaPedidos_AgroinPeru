import { ChangeDetectionStrategy, Component, Injectable, inject, signal } from '@angular/core';

interface Pedido {
  titulo: string;
  mensaje: string;
  textoOk: string;
  peligro: boolean;
  resolver: (v: boolean) => void;
}

/** Confirmaciones con diseño propio (reemplaza a window.confirm). */
@Injectable({ providedIn: 'root' })
export class Confirmacion {
  readonly actual = signal<Pedido | null>(null);

  preguntar(mensaje: string, opciones: { titulo?: string; textoOk?: string; peligro?: boolean } = {}): Promise<boolean> {
    return new Promise(resolver => {
      this.actual.set({
        titulo: opciones.titulo ?? 'Confirmar acción',
        mensaje,
        textoOk: opciones.textoOk ?? 'Confirmar',
        peligro: opciones.peligro ?? false,
        resolver
      });
    });
  }

  responder(valor: boolean): void {
    this.actual()?.resolver(valor);
    this.actual.set(null);
  }
}

@Component({
  selector: 'ap-confirmacion',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (servicio.actual(); as c) {
      <div class="ap-modal-fondo" (click)="servicio.responder(false)">
        <div class="ap-modal" style="max-width: 440px" (click)="$event.stopPropagation()">
          <div class="ap-modal-cuerpo">
            <div class="ap-confirm-icono" [class.peligro]="c.peligro">!</div>
            <h3 style="text-align:center; margin-bottom: 8px; font-size: 18px;">{{ c.titulo }}</h3>
            <p class="ap-confirm-texto">{{ c.mensaje }}</p>
          </div>
          <div class="ap-modal-pie" style="justify-content: center">
            <button type="button" class="ap-btn ap-btn-suave" (click)="servicio.responder(false)">Cancelar</button>
            <button type="button" class="ap-btn" [class.ap-btn-peligro-solido]="c.peligro"
                    [class.ap-btn-primario]="!c.peligro" (click)="servicio.responder(true)">{{ c.textoOk }}</button>
          </div>
        </div>
      </div>
    }
  `
})
export class ConfirmacionVista {
  protected servicio = inject(Confirmacion);
}

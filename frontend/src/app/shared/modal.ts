import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Icono } from './icono';

@Component({
  selector: 'ap-modal',
  imports: [Icono],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (abierto()) {
      <div class="ap-modal-fondo" (click)="cerrar.emit()">
        <div class="ap-modal" [class.ancho]="ancho()" (click)="$event.stopPropagation()">
          <div class="ap-modal-cab">
            <h3>{{ titulo() }}</h3>
            <button type="button" class="ap-modal-x" aria-label="Cerrar" (click)="cerrar.emit()"><ap-icono nombre="x" /></button>
          </div>
          <div class="ap-modal-cuerpo"><ng-content /></div>
          <div class="ap-modal-pie"><ng-content select="[pie]" /></div>
        </div>
      </div>
    }
  `
})
export class Modal {
  abierto = input.required<boolean>();
  titulo = input('');
  ancho = input(false);
  cerrar = output<void>();
}

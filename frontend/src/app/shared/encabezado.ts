import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'ap-encabezado',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ap-encabezado">
      <div>
        <h1>{{ titulo() }}</h1>
        @if (subtitulo()) { <p>{{ subtitulo() }}</p> }
      </div>
      <div class="ap-acciones"><ng-content /></div>
    </div>
  `
})
export class Encabezado {
  titulo = input.required<string>();
  subtitulo = input('');
}

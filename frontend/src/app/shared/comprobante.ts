import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { VentaDocumento, htmlComprobante, imprimirMarco, tituloComprobante } from './documentos';
import { claseEstadoPedido, fechaHora, soles, textoEstadoPedido } from './formato';
import { Icono } from './icono';

/**
 * Ventana con la boleta / factura de una venta, igual para Administración, Caja y Almacén.
 * El documento se muestra en un iframe: lo que se ve aquí es exactamente lo que se imprime.
 */
@Component({
  selector: 'ap-comprobante',
  imports: [Icono],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ap-modal-fondo" (click)="cerrar.emit()">
      <div class="ap-modal ancho" role="dialog" aria-modal="true" [attr.aria-label]="titulo()" (click)="$event.stopPropagation()">
        <div class="ap-modal-cab">
          <button type="button" class="ap-btn ap-btn-primario" [disabled]="!listo()" (click)="imprimir()">
            <ap-icono nombre="imprimir" /> Imprimir / Exportar PDF
          </button>
          <button type="button" class="ap-modal-x" aria-label="Cerrar" (click)="cerrar.emit()"><ap-icono nombre="x" /></button>
        </div>
        <div class="ap-modal-cuerpo">
          <iframe #marco class="documento" [title]="titulo()" [srcdoc]="html()" (load)="alCargar()"></iframe>

          <div class="interna">
            <h4>Información interna (no forma parte del comprobante)</h4>
            <div class="cj-datos" style="padding: 0; border-bottom: 0">
              <div><small>Estado</small><span [class]="'ap-badge ' + claseEstado(venta().estado)">{{ textoEstado(venta().estado) }}</span></div>
              @for (d of datos(); track d.etiqueta) {
                <div><small>{{ d.etiqueta }}</small><strong>{{ d.valor }}</strong></div>
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .documento { display: block; width: 100%; height: 640px; border: 1px solid #e2e8f0; border-radius: 8px; background: #fff; }
    .interna { margin-top: 18px; padding-top: 14px; border-top: 1px dashed #cbd5e1; }
    .interna h4 { font-size: 11.5px; text-transform: uppercase; letter-spacing: .6px; color: #64748b; margin: 0 0 12px; }
  `]
})
export class Comprobante {
  venta = input.required<VentaDocumento>();
  cerrar = output<void>();

  private sanitizer = inject(DomSanitizer);
  private marco = viewChild.required<ElementRef<HTMLIFrameElement>>('marco');

  protected claseEstado = claseEstadoPedido;
  protected textoEstado = textoEstadoPedido;
  protected listo = signal(false);

  protected titulo = computed(() => tituloComprobante(this.venta()));
  // htmlComprobante escapa todos los datos de la venta antes de armar el documento.
  protected html = computed(() => this.sanitizer.bypassSecurityTrustHtml(htmlComprobante(this.venta())));

  protected datos = computed(() => {
    const v = this.venta();
    const lista = [
      { etiqueta: 'Ticket', valor: v.id },
      { etiqueta: 'Correo', valor: v.correo },
      { etiqueta: 'Teléfono', valor: v.telefono },
      { etiqueta: 'Pedido emitido', valor: fechaHora(v.fechaEmision) },
      { etiqueta: 'Pagado', valor: fechaHora(v.fechaPago) },
      { etiqueta: 'Método', valor: v.metodoPago ?? '—' }
    ];
    if (v.metodoPago === 'Efectivo') {
      lista.push(
        { etiqueta: 'Efectivo recibido', valor: soles(v.montoRecibido) },
        { etiqueta: 'Vuelto entregado', valor: soles(v.vueltoEntregado) }
      );
    }
    if (v.numOperacion) lista.push({ etiqueta: 'N° de operación', valor: v.numOperacion });
    lista.push(
      { etiqueta: 'Entregado', valor: v.fechaEntrega ? fechaHora(v.fechaEntrega) : 'Pendiente' },
      {
        etiqueta: 'Recoge',
        valor: v.personaAutorizada ? `${v.personaAutorizada.nombre} (DNI ${v.personaAutorizada.dni})` : 'Titular de la compra'
      }
    );
    return lista;
  });

  /** El alto del iframe se ajusta al documento, para que no tenga su propia barra de desplazamiento. */
  protected alCargar(): void {
    const iframe = this.marco().nativeElement;
    const alto = iframe.contentDocument?.documentElement.scrollHeight;
    if (alto) iframe.style.height = `${alto + 2}px`;
    this.listo.set(true);
  }

  protected imprimir(): void {
    imprimirMarco(this.marco().nativeElement, this.titulo());
  }
}

import { Component, afterNextRender, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { api, mensajeError } from '../../../core/utils/api';
import { AgroUI } from '../../../core/utils/agro-ui';
import { Confirmacion } from '../../../shared/confirmacion';
import { Encabezado } from '../../../shared/encabezado';
import { fechaHora, hace, inicial } from '../../../shared/formato';
import { Icono } from '../../../shared/icono';

type EstadoSolicitud = 'PENDIENTE' | 'ATENDIDA' | 'RECHAZADA';

interface Solicitud {
  id: number;
  estado: EstadoSolicitud;
  fechaSolicitud: string;
  fechaAtencion: string | null;
  observacion: string;
  atendidoPor: string;
  usuario: {
    id: number;
    nombre: string;
    correo: string;
    documentoTipo: string;
    documentoNumero: string;
    telefono: string;
    rol: string;
    estado: string;
  };
}

const ESTADOS: { v: EstadoSolicitud | ''; t: string }[] = [
  { v: 'PENDIENTE', t: 'Pendientes' },
  { v: 'ATENDIDA', t: 'Atendidas' },
  { v: 'RECHAZADA', t: 'Rechazadas' },
  { v: '', t: 'Todas' }
];

/** Soporte: atiende las solicitudes de "¿Olvidaste tu contraseña?" del login. */
@Component({
  selector: 'app-soporte',
  imports: [FormsModule, Encabezado, Icono],
  templateUrl: './soporte.html'
})
export class Soporte {
  private confirmacion = inject(Confirmacion);

  protected estados = ESTADOS;
  protected fechaHora = fechaHora;
  protected hace = hace;
  protected inicial = inicial;

  protected cargando = signal(true);
  protected error = signal('');
  protected lista = signal<Solicitud[]>([]);
  protected filtro = signal<EstadoSolicitud | ''>('PENDIENTE');
  protected busqueda = signal('');
  protected procesando = signal<number | null>(null);

  protected visibles = computed(() => {
    const q = this.busqueda().trim().toLowerCase();
    const estado = this.filtro();
    return this.lista().filter(s =>
      (!estado || s.estado === estado) &&
      (!q || `${s.usuario.nombre} ${s.usuario.correo} ${s.usuario.documentoNumero}`.toLowerCase().includes(q))
    );
  });

  protected conteo = computed(() => {
    const c: Record<string, number> = { '': this.lista().length };
    ESTADOS.forEach(e => e.v && (c[e.v] = this.lista().filter(s => s.estado === e.v).length));
    return c;
  });

  constructor() {
    afterNextRender(() => this.cargar());
  }

  protected claseEstado(e: EstadoSolicitud): string {
    return e === 'PENDIENTE' ? 'ap-b-ambar' : e === 'ATENDIDA' ? 'ap-b-verde' : 'ap-b-rojo';
  }

  protected async cargar(): Promise<void> {
    this.cargando.set(true);
    try {
      this.lista.set(await api.get<Solicitud[]>('/soporte/solicitudes'));
      this.error.set('');
    } catch (e) {
      this.error.set(mensajeError(e));
    } finally {
      this.cargando.set(false);
    }
  }

  protected async restablecer(s: Solicitud): Promise<void> {
    const ok = await this.confirmacion.preguntar(
      `Antes de continuar, confirma la identidad de ${s.usuario.nombre} (por ejemplo, llamando al ${s.usuario.telefono}). ` +
        'Su contraseña pasará a ser 12345678 y deberá cambiarla al iniciar sesión.',
      { titulo: 'Restablecer contraseña', textoOk: 'Poner contraseña temporal' }
    );
    if (!ok) return;

    this.procesando.set(s.id);
    try {
      await api.post(`/soporte/solicitudes/${s.id}/restablecer`);
      AgroUI.toast(`${s.usuario.nombre} ya puede entrar con 12345678.`, 'success', 'Contraseña restablecida');
      await this.cargar();
    } catch (e) {
      AgroUI.toast(mensajeError(e), 'error');
    } finally {
      this.procesando.set(null);
    }
  }

  protected async rechazar(s: Solicitud): Promise<void> {
    const ok = await this.confirmacion.preguntar(
      `La solicitud de ${s.usuario.nombre} se cerrará sin cambiar su contraseña.`,
      { titulo: 'Rechazar solicitud', textoOk: 'Rechazar', peligro: true }
    );
    if (!ok) return;

    this.procesando.set(s.id);
    try {
      await api.post(`/soporte/solicitudes/${s.id}/rechazar`, { motivo: 'No se pudo verificar la identidad' });
      AgroUI.toast('Solicitud rechazada.', 'success');
      await this.cargar();
    } catch (e) {
      AgroUI.toast(mensajeError(e), 'error');
    } finally {
      this.procesando.set(null);
    }
  }
}

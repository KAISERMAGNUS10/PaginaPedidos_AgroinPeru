import { Component, OnDestroy, ViewEncapsulation, afterNextRender, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SesionUsuario } from '../../../models/sesion.model';
import { Ticket } from '../../../models/ticket.model';
import { api, mensajeError } from '../../../core/utils/api';
import { AgroUI } from '../../../core/utils/agro-ui';
import { guardarSesionSegura, limpiarSesionSegura, obtenerSesionSegura } from '../../../core/utils/auth-storage';
import { sincronizarCarritoAlIniciarSesion } from '../../../core/utils/carrito-store';
import { ejecutarPagina, irA, type Limpiador } from '../../../core/utils/navegacion';
import { iniciarGlobalPublico } from '../../../core/utils/layout-global';
import { destinoPorRol } from '../../../core/utils/staff-nav';
import { fecha, soles, textoEstadoPedido } from '../../../shared/formato';
import { TiendaHeader } from '../../../shared/tienda-header';
import { Icono } from '../../../shared/icono';

type Seccion = 'datos' | 'seguridad' | 'pedidos';

interface DatosCuenta {
  DocumentoTipo?: string;
  DocumentoNumero?: string;
  Telefono?: string | null;
}

const ROLES: Record<string, string> = {
  CLIENTE: 'Cliente',
  ADMIN: 'Administrador',
  CAJA: 'Cajero',
  PICKING: 'Almacén',
  SOPORTE: 'Soporte'
};

/**
 * Mi cuenta: datos del usuario, cambio de contraseña y últimos pedidos.
 * Si soporte le asignó una contraseña temporal, solo se muestra el cambio de contraseña.
 */
@Component({
  selector: 'app-mi-cuenta',
  imports: [FormsModule, RouterLink, TiendaHeader, Icono],
  templateUrl: './mi-cuenta.html',
  styleUrls: ['./mi-cuenta.css', '../../../../styles/header.css', '../../../../styles/ui-enhancements.css'],
  encapsulation: ViewEncapsulation.None,
  host: { style: 'display: contents' }
})
export class MiCuenta implements OnDestroy {
  protected sesion = signal<SesionUsuario | null>(null);
  protected datos = signal<DatosCuenta | null>(null);
  protected pedidos = signal<Ticket[] | null>(null);
  protected seccion = signal<Seccion>('datos');
  protected guardando = signal(false);
  protected error = signal('');
  protected verPassword = signal(false);

  protected actual = '';
  protected nueva = signal('');
  protected confirmar = '';

  protected readonly fecha = fecha;
  protected readonly soles = soles;
  protected readonly textoEstado = textoEstadoPedido;

  protected esCliente = computed(() => this.sesion()?.Rol === 'CLIENTE');
  protected temporal = computed(() => this.sesion()?.DebeCambiarPassword === true);
  protected rolTexto = computed(() => ROLES[this.sesion()?.Rol ?? ''] ?? '');
  protected iniciales = computed(() => {
    const s = this.sesion();
    return ((s?.Nombre?.[0] ?? '') + (s?.Apellidos?.[0] ?? '')).toUpperCase() || '?';
  });

  /** Reglas de la contraseña (las mismas que valida el backend). */
  protected reglas = computed(() => {
    const p = this.nueva();
    return [
      { texto: 'Mínimo 8 caracteres', ok: p.length >= 8 },
      { texto: 'Una letra mayúscula', ok: /[A-Z]/.test(p) },
      { texto: 'Una letra minúscula', ok: /[a-z]/.test(p) },
      { texto: 'Un número', ok: /\d/.test(p) }
    ];
  });

  private limpiar: Limpiador | null = null;

  constructor() {
    afterNextRender(async () => {
      const sesion = obtenerSesionSegura() as SesionUsuario | null;
      if (!sesion) {
        irA('/login', true);
        return;
      }
      this.sesion.set(sesion);
      if (sesion.DebeCambiarPassword) this.seccion.set('seguridad');

      // Cabecera: saludo, carrito y notificaciones.
      this.limpiar = ejecutarPagina(() => iniciarGlobalPublico());

      try {
        this.datos.set(await api.get('/auth/me'));
      } catch {
        /* sin datos extra: se muestran los de la sesión */
      }
      if (sesion.Rol === 'CLIENTE' && !sesion.DebeCambiarPassword) this.cargarPedidos();
    });
  }

  ngOnDestroy(): void {
    this.limpiar?.();
  }

  private async cargarPedidos(): Promise<void> {
    try {
      const lista = await api.get<Ticket[]>('/pedidos/mis-pedidos');
      this.pedidos.set(
        [...lista].sort((a, b) => new Date(b.fechaEmision).getTime() - new Date(a.fechaEmision).getTime())
      );
    } catch {
      this.pedidos.set([]);
    }
  }

  protected panel(): string {
    return destinoPorRol(this.sesion()?.Rol ?? 'CLIENTE');
  }

  protected cerrarSesion(): void {
    limpiarSesionSegura();
    window.location.assign('/');
  }

  protected async cambiar(): Promise<void> {
    this.error.set('');
    if (this.reglas().some(r => !r.ok)) {
      this.error.set('La nueva contraseña no cumple todos los requisitos.');
      return;
    }
    if (this.nueva() !== this.confirmar) {
      this.error.set('La nueva contraseña y su confirmación no coinciden.');
      return;
    }

    this.guardando.set(true);
    try {
      await api.put('/auth/password', { actual: this.actual, nueva: this.nueva() });

      const sesion = this.sesion()!;
      const eraTemporal = sesion.DebeCambiarPassword === true;
      guardarSesionSegura({ ...sesion, DebeCambiarPassword: false });
      AgroUI.toast('Tu contraseña se actualizó correctamente.', 'success', 'Contraseña actualizada');

      this.actual = '';
      this.nueva.set('');
      this.confirmar = '';

      // Venía del login con la contraseña temporal: termina de iniciar sesión.
      if (eraTemporal) {
        await sincronizarCarritoAlIniciarSesion();
        irA(this.panel());
        return;
      }
      this.sesion.set({ ...sesion, DebeCambiarPassword: false });
    } catch (e) {
      this.error.set(mensajeError(e));
    } finally {
      this.guardando.set(false);
    }
  }
}

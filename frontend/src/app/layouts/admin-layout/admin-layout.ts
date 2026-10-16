import { Component, ViewEncapsulation, afterNextRender, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SesionUsuario } from '../../models/sesion.model';
import { AuthService } from '../../core/services/auth.service';
import { ConfirmacionVista } from '../../shared/confirmacion';
import { inicial } from '../../shared/formato';
import { Icono } from '../../shared/icono';

interface ItemMenu {
  ruta: string;
  texto: string;
  icono: string;
  exacto: boolean;
}

const MENU: Record<string, { panel: string; items: ItemMenu[] }> = {
  ADMIN: {
    panel: 'Administración',
    items: [
      { ruta: '/admin', texto: 'Dashboard', icono: 'dashboard', exacto: true },
      { ruta: '/admin/ventas', texto: 'Ventas', icono: 'ventas', exacto: false },
      { ruta: '/admin/compras', texto: 'Compras', icono: 'compras', exacto: false },
      { ruta: '/admin/inventario', texto: 'Inventario', icono: 'inventario', exacto: false },
      { ruta: '/admin/reportes', texto: 'Reportes', icono: 'reportes', exacto: false },
      { ruta: '/admin/usuarios', texto: 'Usuarios', icono: 'usuarios', exacto: false }
    ]
  },
  CAJA: { panel: 'Caja', items: [{ ruta: '/admin/caja', texto: 'Caja', icono: 'caja', exacto: false }] },
  PICKING: { panel: 'Almacén', items: [{ ruta: '/admin/picking', texto: 'Almacén', icono: 'almacen', exacto: false }] }
};

const ROLES: Record<string, string> = { ADMIN: 'Administrador', CAJA: 'Cajero', PICKING: 'Almacenero' };

/** Panel interno: Administrador, Caja y Almacén (menú lateral según el rol). */
@Component({
  selector: 'app-admin-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icono, ConfirmacionVista],
  templateUrl: './admin-layout.html',
  styleUrls: ['../../../styles/panel.css', '../../../styles/ui-enhancements.css'],
  // Estilos globales a propósito: se comparten con todas las pantallas del panel (clases "ap-").
  encapsulation: ViewEncapsulation.None
})
export class AdminLayout {
  private auth = inject(AuthService);
  private router = inject(Router);

  protected usuario = signal<SesionUsuario | null>(null);
  protected menuAbierto = signal(false);

  protected config = computed(() => MENU[this.usuario()?.Rol ?? ''] ?? { panel: 'Panel', items: [] });
  protected rolTexto = computed(() => ROLES[this.usuario()?.Rol ?? ''] ?? '');
  protected inicial = computed(() => inicial(this.usuario()?.Nombre));

  constructor() {
    // La sesión vive en localStorage (solo navegador): se lee después del primer render.
    afterNextRender(() => this.usuario.set(this.auth.sesion()));
  }

  protected salir(): void {
    this.auth.cerrarSesion();
    this.router.navigateByUrl('/login');
  }
}

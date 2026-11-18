import { Component, ViewEncapsulation, afterNextRender, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icono } from './icono';
import { cargarCategorias } from '../core/data/catalogo-data';
import { irA } from '../core/utils/navegacion';
import { alternarTema, temaActual } from '../core/utils/tema';

/**
 * Cabecera única de la tienda (inicio, producto, carrito, checkout, ticket, mis pedidos y mi cuenta).
 * - Buscador: en el catálogo filtra al escribir; en otras páginas lleva al catálogo con la búsqueda.
 * - Menú lateral: categorías reales del catálogo, accesos de la cuenta y cambio de tema.
 * - Los id (user-trigger, cart-counter, notif-bell…) los usa layout-global.ts para la sesión,
 *   el contador del carrito y las notificaciones.
 */
@Component({
  selector: 'ap-tienda-header',
  imports: [RouterLink, Icono],
  encapsulation: ViewEncapsulation.None,
  host: { style: 'display: contents' },
  template: `
    <header class="navbar-tottus">
      <div class="header-left">
        <button type="button" class="btn-menu-tottus" aria-label="Abrir menú de categorías" (click)="menuAbierto.set(true)">
          <ap-icono nombre="menu" /><span class="solo-escritorio">Categorías</span>
        </button>
        <a routerLink="/" class="logo-container" aria-label="AGROINPERU, ir al inicio">
          <img src="img/logoagroperu.jpg" alt="" class="logo-drop">
          <span class="logo-text"><span class="text-blue">AGROIN</span><span class="text-red">PERU</span></span>
        </a>
      </div>

      <form class="header-search" role="search" (submit)="buscar($event)">
        <ap-icono nombre="buscar" class="header-search-icono" />
        <input type="search" id="header-search-input" name="q" autocomplete="off" enterkeyhint="search"
               placeholder="Buscar válvulas, codos, mangueras, medidas…" aria-label="Buscar productos">
        <button type="submit" class="btn-search" id="btn-header-search">Buscar</button>
      </form>

      <div class="header-right">
        <button type="button" class="btn-icono" (click)="alternarTema()"
                [attr.aria-label]="tema() === 'oscuro' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'"
                [attr.title]="tema() === 'oscuro' ? 'Modo claro' : 'Modo oscuro'">
          <ap-icono [nombre]="tema() === 'oscuro' ? 'sol' : 'luna'" />
        </button>

        <div class="notif-bell-container">
          <a href="#" id="notif-bell" class="notif-bell-tottus btn-icono" aria-label="Notificaciones">
            <ap-icono nombre="campana" />
            <span class="notif-bell-dot" id="notif-bell-dot" style="display:none;"></span>
          </a>
          <div id="notif-dropdown" class="notif-dropdown"></div>
        </div>

        <div class="user-session-container">
          <button type="button" id="user-trigger" class="user-trigger" aria-label="Mi cuenta">
            <ap-icono nombre="usuario" class="user-trigger-icono" />
            <span class="user-text-box">
              <span class="user-greeting-label"></span>
              <span class="user-name-label" id="user-display-name">Iniciar sesión</span>
            </span>
          </button>
          <div id="user-dropdown-menu" class="user-dropdown-tottus">
            <p id="dropdown-user-full">Cargando...</p>
            <a routerLink="/mi-cuenta">Mi cuenta</a>
            <a routerLink="/mis-pedidos">Mis pedidos</a>
            <button type="button" id="btn-logout-tottus" class="btn-logout-tottus">Cerrar sesión</button>
          </div>
        </div>

        <a routerLink="/carrito" class="cart-tottus btn-icono" aria-label="Ver carrito">
          <ap-icono nombre="carrito" />
          <span class="cart-badge" id="cart-counter">0</span>
        </a>
      </div>
    </header>

    <div class="menu-overlay" [class.active]="menuAbierto()" (click)="menuAbierto.set(false)"></div>

    <nav class="side-menu" [class.active]="menuAbierto()" aria-label="Categorías y cuenta">
      <div class="side-menu-header">
        <h2>Categorías</h2>
        <button type="button" class="btn-close-menu" aria-label="Cerrar menú" (click)="menuAbierto.set(false)">
          <ap-icono nombre="x" />
        </button>
      </div>

      <div class="side-menu-content">
        <button type="button" class="side-link" (click)="elegirCategoria('')">
          <ap-icono nombre="tienda" /> <span>Todo el catálogo</span> <span class="category-count">{{ total() }}</span>
        </button>
        @for (c of categorias(); track c.nombre) {
          <button type="button" class="side-link" (click)="elegirCategoria(c.nombre)">
            <span class="side-punto"></span> <span>{{ c.nombre }}</span> <span class="category-count">{{ c.cantidad }}</span>
          </button>
        }

        <h3 class="side-titulo">Mi cuenta</h3>
        <a class="side-link" routerLink="/mi-cuenta" (click)="menuAbierto.set(false)"><ap-icono nombre="usuario" /> <span>Mis datos y contraseña</span></a>
        <a class="side-link" routerLink="/mis-pedidos" (click)="menuAbierto.set(false)"><ap-icono nombre="compras" /> <span>Mis pedidos</span></a>
        <a class="side-link" routerLink="/carrito" (click)="menuAbierto.set(false)"><ap-icono nombre="carrito" /> <span>Carrito</span></a>
        <button type="button" class="side-link" (click)="alternarTema()">
          <ap-icono [nombre]="tema() === 'oscuro' ? 'sol' : 'luna'" />
          <span>{{ tema() === 'oscuro' ? 'Modo claro' : 'Modo oscuro' }}</span>
        </button>
      </div>
    </nav>
  `
})
export class TiendaHeader {
  /** true en la página del catálogo: allí el buscador y las categorías filtran sin cambiar de página. */
  catalogo = input(false);

  protected menuAbierto = signal(false);
  protected categorias = signal<{ nombre: string; cantidad: number }[]>([]);
  protected total = signal(0);
  protected tema = temaActual;
  protected alternarTema = alternarTema;

  constructor() {
    afterNextRender(async () => {
      try {
        const lista = await cargarCategorias();
        this.categorias.set(lista);
        this.total.set(lista.reduce((suma, c) => suma + c.cantidad, 0));
      } catch {
        /* sin conexión: el menú muestra solo los accesos */
      }
    });
  }

  protected buscar(evento: Event): void {
    evento.preventDefault();
    if (this.catalogo()) return; // el catálogo ya filtra mientras se escribe
    const texto = (document.getElementById('header-search-input') as HTMLInputElement | null)?.value.trim() ?? '';
    irA(texto ? `/?q=${encodeURIComponent(texto)}` : '/');
  }

  protected elegirCategoria(categoria: string): void {
    this.menuAbierto.set(false);
    if (this.catalogo()) {
      window.dispatchEvent(new CustomEvent('agro:categoria', { detail: categoria }));
      document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    irA(categoria ? `/?categoria=${encodeURIComponent(categoria)}` : '/');
  }
}

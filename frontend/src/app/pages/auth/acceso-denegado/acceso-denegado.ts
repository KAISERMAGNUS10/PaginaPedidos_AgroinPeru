// @ts-nocheck
import { Component, OnDestroy, ViewEncapsulation, afterNextRender } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ejecutarPagina, type Limpiador } from '../../../core/utils/navegacion';
import { irA } from '../../../core/utils/navegacion';
import { limpiarSesionSegura, obtenerSesionSegura } from '../../../core/utils/auth-storage';

@Component({
  selector: 'app-acceso-denegado',
  imports: [RouterLink],
  templateUrl: './acceso-denegado.html',
  styleUrls: ['../../../../styles/ui-enhancements.css', './acceso-denegado.css'],
  // Estilos de la página sin encapsulación y respetando los espacios del HTML.
  encapsulation: ViewEncapsulation.None,
  preserveWhitespaces: true,
  host: { style: 'display: contents' }
})
export class AccesoDenegado implements OnDestroy {
  private limpiar: Limpiador | null = null;

  constructor() {
    // La lógica necesita que el HTML ya esté en el DOM, por eso corre después del primer render (solo navegador).
    afterNextRender(() => {
      this.limpiar = ejecutarPagina(() => {
        iniciarAccesoDenegado();
      });
    });
  }

  ngOnDestroy(): void {
    this.limpiar?.();
  }
}

// ==========================================================================
// LÓGICA DE LA PÁGINA
// ==========================================================================
function iniciarAccesoDenegado() {

        const sesion = obtenerSesionSegura();
        const destino = sesion && sesion.Rol === 'ADMIN' ? '/admin' : sesion && sesion.Rol === 'CAJA' ? '/admin/caja' : sesion && sesion.Rol === 'PICKING' ? '/admin/picking' : sesion ? '/' : '/login';
        const nombres = {ADMIN:'Administrador',CAJA:'Caja',PICKING:'Almacén / Picking',CLIENTE:'Cliente'};
        document.getElementById('deny-home').href = destino;
        document.getElementById('deny-role').textContent = sesion ? 'Rol actual: ' + (nombres[sesion.Rol] || sesion.Rol) : 'Sesión no iniciada';
        document.getElementById('deny-logout').addEventListener('click', () => { limpiarSesionSegura(); irA('/login'); });
    
}

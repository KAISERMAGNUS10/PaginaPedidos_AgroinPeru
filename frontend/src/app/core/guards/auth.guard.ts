import { isPlatformServer } from '@angular/common';
import { PLATFORM_ID, inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { RolUsuario } from '../../models/sesion.model';
import { AuthService } from '../services/auth.service';

/**
 * Protege las rutas internas: cada rol entra SOLO a su módulo
 * (ADMIN → panel de administración, CAJA → caja, PICKING → almacén).
 * Uso: canActivate: [rolGuard('CAJA')]
 *
 * En el servidor (SSR) no existe localStorage, así que deja pasar:
 * la comprobación real ocurre en el navegador.
 */
export const rolGuard = (modulo: RolUsuario): CanActivateFn => () => {
  if (isPlatformServer(inject(PLATFORM_ID))) {
    return true;
  }

  const auth = inject(AuthService);
  const router = inject(Router);
  const sesion = auth.sesion();

  if (!sesion) {
    return router.createUrlTree(['/login']);
  }

  if (sesion.Rol === modulo) {
    return true;
  }

  return router.createUrlTree(['/acceso-denegado'], { queryParams: { modulo } });
};

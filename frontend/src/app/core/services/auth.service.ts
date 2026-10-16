import { Injectable } from '@angular/core';
import { SesionUsuario, RolUsuario } from '../../models/sesion.model';
import { limpiarSesionSegura, obtenerSesionSegura } from '../utils/auth-storage';

/** Envoltorio tipado sobre la sesión (localStorage + token JWT). Lo usan los guards y el panel interno. */
@Injectable({ providedIn: 'root' })
export class AuthService {
  sesion(): SesionUsuario | null {
    return obtenerSesionSegura() as SesionUsuario | null;
  }

  rol(): RolUsuario | null {
    return this.sesion()?.Rol ?? null;
  }

  estaLogueado(): boolean {
    return this.sesion() !== null;
  }

  esPersonal(): boolean {
    const rol = this.rol();
    return rol === 'ADMIN' || rol === 'CAJA' || rol === 'PICKING' || rol === 'SOPORTE';
  }

  cerrarSesion(): void {
    limpiarSesionSegura();
  }
}

import { Component, ViewEncapsulation, afterNextRender, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SesionUsuario } from '../../../models/sesion.model';
import { api, mensajeError } from '../../../core/utils/api';
import { AgroUI } from '../../../core/utils/agro-ui';
import { guardarSesionSegura, obtenerSesionSegura } from '../../../core/utils/auth-storage';
import { sincronizarCarritoAlIniciarSesion } from '../../../core/utils/carrito-store';
import { irA } from '../../../core/utils/navegacion';
import { destinoPorRol } from '../../../core/utils/staff-nav';

/** Mi cuenta: datos del usuario y cambio de contraseña (obligatorio si soporte le puso la temporal). */
@Component({
  selector: 'app-mi-cuenta',
  imports: [FormsModule, RouterLink],
  templateUrl: './mi-cuenta.html',
  styleUrls: ['../../auth/login/login.css', '../../../../styles/ui-enhancements.css'],
  encapsulation: ViewEncapsulation.None,
  host: { style: 'display: contents' }
})
export class MiCuenta {
  protected sesion = signal<SesionUsuario | null>(null);
  protected datos = signal<{ DocumentoTipo?: string; DocumentoNumero?: string; Telefono?: string | null } | null>(null);
  protected guardando = signal(false);
  protected error = signal('');

  protected actual = '';
  protected nueva = '';
  protected confirmar = '';

  constructor() {
    afterNextRender(async () => {
      const sesion = obtenerSesionSegura() as SesionUsuario | null;
      if (!sesion) {
        irA('/login', true);
        return;
      }
      this.sesion.set(sesion);
      try {
        this.datos.set(await api.get('/auth/me'));
      } catch {
        /* sin datos extra: se muestran los de la sesión */
      }
    });
  }

  protected destino(): string {
    return destinoPorRol(this.sesion()?.Rol ?? 'CLIENTE');
  }

  protected async cambiar(): Promise<void> {
    this.error.set('');
    if (this.nueva !== this.confirmar) {
      this.error.set('La nueva contraseña y su confirmación no coinciden.');
      return;
    }

    this.guardando.set(true);
    try {
      await api.put('/auth/password', { actual: this.actual, nueva: this.nueva });

      const sesion = this.sesion()!;
      const eraTemporal = sesion.DebeCambiarPassword === true;
      guardarSesionSegura({ ...sesion, DebeCambiarPassword: false });
      AgroUI.toast('Tu contraseña se actualizó correctamente.', 'success', 'Contraseña actualizada');

      // Venía del login con la temporal: termina de iniciar sesión.
      if (eraTemporal) await sincronizarCarritoAlIniciarSesion();
      irA(this.destino());
    } catch (e) {
      this.error.set(mensajeError(e));
    } finally {
      this.guardando.set(false);
    }
  }
}

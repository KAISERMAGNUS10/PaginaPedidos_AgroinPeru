// @ts-nocheck
// Migrado de login.html + script en línea
import { Component, OnDestroy, ViewEncapsulation, afterNextRender } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ejecutarPagina, type Limpiador } from '../../../core/utils/navegacion';
import { irA } from '../../../core/utils/navegacion';
import { guardarSesionSegura } from '../../../core/utils/auth-storage';
import { api } from '../../../core/utils/api';
import { destinoPorRol } from '../../../core/utils/staff-nav';
import { sincronizarCarritoAlIniciarSesion } from '../../../core/utils/carrito-store';
import { AgroUI } from '../../../core/utils/agro-ui';
import { iniciarGlobalPublico } from '../../../core/utils/layout-global';

@Component({
  selector: 'app-login',
  imports: [RouterLink],
  templateUrl: './login.html',
  styleUrls: ['./login.css', '../../../../styles/ui-enhancements.css'],
  // Se conserva el CSS original tal cual: sin encapsulación y respetando los espacios del HTML viejo.
  encapsulation: ViewEncapsulation.None,
  preserveWhitespaces: true,
  host: { style: 'display: contents' }
})
export class Login implements OnDestroy {
  private limpiar: Limpiador | null = null;

  constructor() {
    // El JS original necesita que el HTML ya esté en el DOM, por eso corre después del primer render (solo navegador).
    afterNextRender(() => {
      this.limpiar = ejecutarPagina(() => {
        iniciarLogin();
        iniciarGlobalPublico();
      });
    });
  }

  ngOnDestroy(): void {
    this.limpiar?.();
  }
}

// ==========================================================================
// LÓGICA ORIGINAL (copiada tal cual del proyecto viejo)
// ==========================================================================
function iniciarLogin() {
        ['loginCorreo','loginPassword'].forEach(id => document.getElementById(id).addEventListener('input', () => { document.getElementById(id).classList.remove('input-invalid'); document.getElementById('login-error').textContent=''; }));

        const boton = document.getElementById('btnLogin');

        document.getElementById('loginForm').addEventListener('submit', async function(e) {
            e.preventDefault();

            const email = document.getElementById('loginCorreo').value.trim().toLowerCase();
            const pass = document.getElementById('loginPassword').value;

            boton.disabled = true;
            boton.textContent = 'Ingresando...';

            try {
                // El backend valida el correo/clave y entrega el token + el rol (ADMIN, CAJA, PICKING o CLIENTE).
                const { token, usuario } = await api.post('/auth/login', { email, password: pass }, false);

                guardarSesionSegura({
                    id: usuario.id,
                    Nombre: usuario.Nombre,
                    Apellidos: usuario.Apellidos,
                    Correo: usuario.Correo,
                    Rol: usuario.Rol,
                    token
                });

                await sincronizarCarritoAlIniciarSesion();
                irA(destinoPorRol(usuario.Rol));
            } catch (err) {
                const credenciales = err.codigo === 'CREDENCIALES_INVALIDAS';
                document.getElementById('login-error').textContent = credenciales ? 'Correo o contraseña incorrectos.' : err.message;

                if (credenciales) {
                    document.getElementById('loginCorreo').classList.add('input-invalid');
                    document.getElementById('loginPassword').classList.add('input-invalid');
                }
                AgroUI.toast(credenciales ? 'Revisa el correo y la contraseña ingresados.' : err.message, 'error', 'Inicio de sesión fallido');
            } finally {
                boton.disabled = false;
                boton.textContent = 'Iniciar Sesión';
            }
        });
}

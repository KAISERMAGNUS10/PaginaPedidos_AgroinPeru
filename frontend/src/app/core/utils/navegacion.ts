import { Router } from '@angular/router';

/*
|--------------------------------------------------------------------------
| Puente entre el código JavaScript migrado y el Router de Angular
|--------------------------------------------------------------------------
| El proyecto viejo navegaba con window.location.href = 'login.html'.
| Aquí se reemplaza por irA('/login'), que usa el Router (sin recargar).
*/

let router: Router | null = null;

export function registrarRouter(r: Router): void {
  router = r;
}

/** Equivale a window.location.href = destino  (o replace si reemplazar = true) */
export function irA(destino: string, reemplazar = false): void {
  if (typeof window === 'undefined') return;

  const url = new URL(destino, window.location.origin);
  const mismaRuta = url.pathname === window.location.pathname;

  // Misma ruta (solo cambia ?q= o ?categoria=): recarga como en el proyecto viejo.
  if (!router || mismaRuta) {
    if (reemplazar) window.location.replace(url.href);
    else window.location.assign(url.href);
    return;
  }

  router.navigateByUrl(url.pathname + url.search + url.hash, { replaceUrl: reemplazar });
}

/** Antes: document.addEventListener('DOMContentLoaded', fn). Ahora la página ya está pintada. */
export function alCargar(fn: () => void): void {
  fn();
}

/*
|--------------------------------------------------------------------------
| Listeners globales (document / window) con limpieza automática
|--------------------------------------------------------------------------
*/

export type Limpiador = () => void;

let alcanceActual: Limpiador[] | null = null;

export function onGlobal(
  destino: EventTarget,
  tipo: string,
  fn: EventListenerOrEventListenerObject,
  opciones?: boolean | AddEventListenerOptions
): void {
  destino.addEventListener(tipo, fn, opciones);
  alcanceActual?.push(() => destino.removeEventListener(tipo, fn, opciones));
}

/** Registra una función que se ejecuta al salir de la página (p. ej. clearInterval). */
export function alLimpiar(fn: Limpiador): void {
  alcanceActual?.push(fn);
}

/** Ejecuta la inicialización de una página y devuelve la función que quita sus listeners globales. */
export function ejecutarPagina(fn: () => void): Limpiador {
  const anterior = alcanceActual;
  const escuchas: Limpiador[] = [];
  alcanceActual = escuchas;
  try {
    fn();
  } finally {
    alcanceActual = anterior;
  }
  return () => escuchas.forEach(quitar => quitar());
}

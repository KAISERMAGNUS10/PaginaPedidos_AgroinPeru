/*
|--------------------------------------------------------------------------
| Tema claro / oscuro
|--------------------------------------------------------------------------
| El tema elegido se guarda en localStorage. Si la persona nunca eligió,
| se usa el del sistema (celular o Windows en modo oscuro → página oscura).
| index.html aplica el tema antes de pintar para evitar el parpadeo.
*/
import { signal } from '@angular/core';

export type Tema = 'claro' | 'oscuro';
const CLAVE = 'agro_tema';

function temaInicial(): Tema {
  if (typeof document === 'undefined') return 'claro';
  return document.documentElement.dataset['tema'] === 'oscuro' ? 'oscuro' : 'claro';
}

/** Tema actual (señal: los botones se actualizan solos). */
export const temaActual = signal<Tema>(temaInicial());

export function aplicarTema(tema: Tema): void {
  temaActual.set(tema);
  if (typeof document === 'undefined') return;
  document.documentElement.dataset['tema'] = tema;
  try {
    localStorage.setItem(CLAVE, tema);
  } catch {
    /* navegador sin almacenamiento: el tema dura hasta recargar */
  }
}

export function alternarTema(): void {
  aplicarTema(temaActual() === 'oscuro' ? 'claro' : 'oscuro');
}

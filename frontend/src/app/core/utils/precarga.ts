import { AgroUI } from './agro-ui';
import { mensajeError } from './api';

/** Espera una carga de datos; si falla (p. ej. sin conexión) avisa con un toast y deja continuar. */
export function conAviso<T>(promesa: Promise<T>): Promise<T | void> {
  return promesa.catch(error => {
    AgroUI.toast(mensajeError(error), 'error', 'No se pudo cargar la información');
  });
}

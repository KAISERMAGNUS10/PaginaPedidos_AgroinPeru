import { badRequest } from './errores';

export const REGEX = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  dni: /^\d{8}$/,
  ce: /^[a-zA-Z0-9]{6,12}$/,
  ruc: /^(10|15|17|20)\d{9}$/,
  celular: /^9\d{8}$/
};

export function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor.trim() : '';
}

/** Devuelve el primer alias presente en el body (el frontend usa nombres distintos según la pantalla). */
export function pick(body: any, ...alias: string[]): unknown {
  if (!body || typeof body !== 'object') return undefined;
  for (const a of alias) {
    if (body[a] !== undefined && body[a] !== null) return body[a];
  }
  return undefined;
}

export function validarEmail(valor: unknown): string {
  const email = texto(valor).toLowerCase();
  if (!email) throw badRequest('EMAIL_OBLIGATORIO', 'El correo es obligatorio.');
  if (!REGEX.email.test(email)) throw badRequest('EMAIL_INVALIDO', 'Ingresa un correo válido.');
  return email;
}

export function validarPasswordNueva(valor: unknown): string {
  const p = typeof valor === 'string' ? valor : '';
  if (
    p.length < 8 ||
    !/\d/.test(p) ||
    !/[A-Z]/.test(p) ||
    !/[a-z]/.test(p)
  ) {
    throw badRequest(
      'PASSWORD_DEBIL',
      'La contraseña debe tener mínimo 8 caracteres, con mayúscula, minúscula y número.'
    );
  }
  return p;
}

/** Normaliza el celular a +51XXXXXXXXX. Acepta "9XXXXXXXX" o "+519XXXXXXXX". */
export function validarCelular(valor: unknown): string {
  const limpio = texto(valor).replace(/[\s-]/g, '');
  const nueve = limpio.startsWith('+51') ? limpio.slice(3) : limpio;
  if (!REGEX.celular.test(nueve)) {
    throw badRequest('CELULAR_INVALIDO', 'Celular inválido (9 dígitos, empieza con 9).');
  }
  return `+51${nueve}`;
}

/** Para el checkout el teléfono se guarda tal como lo muestra el frontend: 9 dígitos. */
export function validarTelefono9(valor: unknown): string {
  const limpio = texto(valor).replace(/[\s-]/g, '');
  const nueve = limpio.startsWith('+51') ? limpio.slice(3) : limpio;
  if (!REGEX.celular.test(nueve)) {
    throw badRequest('TELEFONO_INVALIDO', 'El teléfono debe tener 9 dígitos y empezar con 9.');
  }
  return nueve;
}

export type TipoDocumento = 'DNI' | 'CE' | 'RUC';

export function normalizarTipoDocumento(valor: unknown): TipoDocumento {
  const v = texto(valor).toUpperCase();
  if (v === 'DNI') return 'DNI';
  if (v === 'RUC') return 'RUC';
  if (v === 'CE' || v.startsWith('CE') || v.includes('PASAPORTE') || v.includes('EXTRANJER')) {
    return 'CE';
  }
  throw badRequest('TIPO_DOCUMENTO_INVALIDO', 'Tipo de documento no válido.');
}

export function validarNumeroDocumento(tipo: TipoDocumento, valor: unknown): string {
  const n = texto(valor);
  if (tipo === 'DNI' && !REGEX.dni.test(n)) {
    throw badRequest('DOCUMENTO_INVALIDO', 'El DNI debe tener exactamente 8 dígitos.');
  }
  if (tipo === 'CE' && !REGEX.ce.test(n)) {
    throw badRequest('DOCUMENTO_INVALIDO', 'Documento inválido (6 a 12 caracteres).');
  }
  if (tipo === 'RUC' && !REGEX.ruc.test(n)) {
    throw badRequest(
      'DOCUMENTO_INVALIDO',
      'El RUC debe tener 11 dígitos y empezar con 10, 15, 17 o 20.'
    );
  }
  return n;
}

export function enteroPositivo(valor: unknown, codigo = 'CANTIDAD_INVALIDA'): number {
  const n = Number(valor);
  if (!Number.isInteger(n) || n <= 0 || n > 100000) {
    throw badRequest(codigo, 'La cantidad debe ser un número entero mayor a 0.');
  }
  return n;
}

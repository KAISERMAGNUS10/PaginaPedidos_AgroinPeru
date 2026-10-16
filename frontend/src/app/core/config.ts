/**
 * URL base del backend.
 * - En tu PC (localhost) usa el backend local: si cambias PORT en backend/.env, cámbialo aquí.
 * - Publicado (Vercel) usa la URL del proyecto backend en Vercel: reemplázala por la tuya.
 */
const API_LOCAL = 'http://localhost:3000/api';
const API_PRODUCCION = 'https://agroinperu-api.vercel.app/api';

const enLocal =
  typeof window === 'undefined' || ['localhost', '127.0.0.1'].includes(window.location.hostname);

export const API_URL = enLocal ? API_LOCAL : API_PRODUCCION;

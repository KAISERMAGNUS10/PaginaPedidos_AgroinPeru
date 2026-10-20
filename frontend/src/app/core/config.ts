/**
 * URL base de la API. El frontend y la API se publican juntos en Vercel,
 * así que la API vive en el mismo dominio: https://<tu-proyecto>.vercel.app/api
 */
const ORIGEN = typeof window === 'undefined' ? 'http://localhost' : window.location.origin;

export const API_URL = `${ORIGEN}/api`;

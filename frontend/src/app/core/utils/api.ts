// Cliente HTTP único para hablar con el backend (fetch + token JWT).
import { API_URL } from '../config';
import { limpiarSesionSegura, obtenerToken } from './auth-storage';
import { irA } from './navegacion';

export class ApiError extends Error {
  constructor(
    public status: number,
    public codigo: string,
    mensaje: string
  ) {
    super(mensaje);
    this.name = 'ApiError';
  }
}

interface Opciones {
  method?: string;
  body?: unknown;
  query?: Record<string, string | number | boolean | null | undefined>;
  /** false = no enviar el token (login, registro, catálogo). */
  auth?: boolean;
}

const CODIGOS_SESION_INVALIDA = ['TOKEN_REQUERIDO', 'TOKEN_INVALIDO', 'TOKEN_FORMATO_INVALIDO', 'CUENTA_NO_DISPONIBLE'];

export async function apiFetch<T = any>(ruta: string, opciones: Opciones = {}): Promise<T> {
  const url = new URL(API_URL + ruta);

  Object.entries(opciones.query ?? {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  });

  const headers: Record<string, string> = {};
  if (opciones.body !== undefined) headers['Content-Type'] = 'application/json';

  const token = opciones.auth === false ? null : obtenerToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let respuesta: Response;
  try {
    respuesta = await fetch(url.toString(), {
      method: opciones.method ?? 'GET',
      headers,
      body: opciones.body !== undefined ? JSON.stringify(opciones.body) : undefined
    });
  } catch {
    throw new ApiError(
      0,
      'SIN_CONEXION',
      'No se pudo conectar con el servidor. Revisa tu conexión a internet e inténtalo nuevamente.'
    );
  }

  let json: any = null;
  try {
    json = await respuesta.json();
  } catch {
    /* respuesta sin cuerpo */
  }

  if (!respuesta.ok) {
    const codigo = json?.code ?? 'ERROR';

    // Sesión vencida o cuenta bloqueada: se limpia y se envía al login.
    if (respuesta.status === 401 && token && CODIGOS_SESION_INVALIDA.includes(codigo)) {
      limpiarSesionSegura();
      irA('/login', true);
    }

    throw new ApiError(respuesta.status, codigo, json?.message ?? 'Ocurrió un error inesperado.');
  }

  return json?.data as T;
}

export const api = {
  get: <T = any>(ruta: string, query?: Opciones['query'], auth = true) =>
    apiFetch<T>(ruta, { query, auth }),
  post: <T = any>(ruta: string, body?: unknown, auth = true) =>
    apiFetch<T>(ruta, { method: 'POST', body: body ?? {}, auth }),
  put: <T = any>(ruta: string, body?: unknown) => apiFetch<T>(ruta, { method: 'PUT', body: body ?? {} }),
  patch: <T = any>(ruta: string, body?: unknown) => apiFetch<T>(ruta, { method: 'PATCH', body: body ?? {} }),
  delete: <T = any>(ruta: string) => apiFetch<T>(ruta, { method: 'DELETE' })
};

/** Mensaje legible para mostrar al usuario a partir de cualquier error. */
export function mensajeError(e: unknown): string {
  return e instanceof Error ? e.message : 'Ocurrió un error inesperado.';
}

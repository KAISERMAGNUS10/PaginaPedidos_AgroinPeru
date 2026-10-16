/**
 * Error controlado de la aplicación.
 * El middleware global lo convierte en una respuesta JSON con el status indicado.
 */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly codigo: string,
    mensaje?: string
  ) {
    super(mensaje ?? codigo);
    this.name = 'AppError';
  }
}

export const badRequest = (codigo: string, mensaje?: string) =>
  new AppError(400, codigo, mensaje);

export const noAutorizado = (codigo: string, mensaje?: string) =>
  new AppError(401, codigo, mensaje);

export const prohibido = (codigo: string, mensaje?: string) =>
  new AppError(403, codigo, mensaje);

export const noEncontrado = (codigo: string, mensaje?: string) =>
  new AppError(404, codigo, mensaje);

export const conflicto = (codigo: string, mensaje?: string) =>
  new AppError(409, codigo, mensaje);

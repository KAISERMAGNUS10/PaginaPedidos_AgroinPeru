export type RolUsuario = 'ADMIN' | 'CAJA' | 'PICKING' | 'SOPORTE' | 'CLIENTE';

export const ROLES_VALIDOS: RolUsuario[] = ['ADMIN', 'CAJA', 'PICKING', 'SOPORTE', 'CLIENTE'];

export interface AuthPayload {
  id: number;
  rol: RolUsuario;
  email: string;
}

/**
 * Misma forma que la sesión que hoy guarda el frontend
 * (SesionUsuario: Nombre, Apellidos, Correo, Rol) + id.
 */
export interface UsuarioSesion {
  id: number;
  Nombre: string;
  Apellidos: string;
  Correo: string;
  Rol: RolUsuario;
  Telefono?: string | null;
  DocumentoTipo?: string;
  DocumentoNumero?: string;
  /** true cuando soporte le puso la contraseña temporal: debe cambiarla al entrar. */
  DebeCambiarPassword?: boolean;
}

export interface RegistroDto {
  nombre?: string;
  apellidos?: string;
  correo?: string;
  email?: string;
  password?: string;
  pass?: string;
  documentoTipo?: string;
  documentoNumero?: string;
  celular?: string;
  telefono?: string;
}

export type RolUsuario = 'ADMIN' | 'CAJA' | 'PICKING' | 'CLIENTE';

/** Sesión guardada en localStorage (clave agro_sesion_usuario). Incluye el token JWT del backend. */
export interface SesionUsuario {
  id?: number;
  Nombre: string;
  Apellidos: string;
  Correo: string;
  Rol: RolUsuario;
  token?: string;
  loginTime?: number;
}

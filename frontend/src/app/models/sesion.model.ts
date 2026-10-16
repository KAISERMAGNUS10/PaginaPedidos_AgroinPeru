export type RolUsuario = 'ADMIN' | 'CAJA' | 'PICKING' | 'SOPORTE' | 'CLIENTE';

/** Sesión guardada en localStorage (clave agro_sesion_usuario). Incluye el token JWT del backend. */
export interface SesionUsuario {
  id?: number;
  Nombre: string;
  Apellidos: string;
  Correo: string;
  Rol: RolUsuario;
  /** true = entró con la contraseña temporal de soporte y debe cambiarla. */
  DebeCambiarPassword?: boolean;
  token?: string;
  loginTime?: number;
}

// Destino inicial de cada rol después de iniciar sesión.
export function destinoPorRol(rol: string): string {
  if (rol === 'ADMIN') return '/admin';
  if (rol === 'CAJA') return '/admin/caja';
  if (rol === 'PICKING') return '/admin/picking';
  if (rol === 'SOPORTE') return '/admin/soporte';
  return '/';
}

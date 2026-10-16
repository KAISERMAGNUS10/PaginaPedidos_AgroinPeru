import { Conexion, Fila, pool, ResultadoEscritura } from '../config/database';
import { RolUsuario } from '../models/auth.model';

export interface UsuarioRow extends Fila {
  id_usuario: number;
  id_rol: number;
  nombre_rol: RolUsuario;
  nombres: string;
  apellidos: string;
  tipo_documento: string;
  numero_documento: string;
  email: string;
  password_hash: string;
  telefono: string;
  direccion: string | null;
  estado: 'ACTIVO' | 'INACTIVO' | 'BLOQUEADO';
  fecha_registro: Date;
  ultimo_acceso: Date | null;
  debe_cambiar_password?: number;
}

const SELECT_USUARIO = `
  SELECT u.*, r.nombre_rol
    FROM tbl_usuarios u
    JOIN tbl_roles r ON r.id_rol = u.id_rol
`;

export class UsuarioRepository {
  async porEmail(email: string): Promise<UsuarioRow | null> {
    const [rows] = await pool.query<UsuarioRow[]>(
      `${SELECT_USUARIO} WHERE u.email = ? LIMIT 1`,
      [email]
    );
    return rows[0] ?? null;
  }

  async porId(id: number): Promise<UsuarioRow | null> {
    const [rows] = await pool.query<UsuarioRow[]>(
      `${SELECT_USUARIO} WHERE u.id_usuario = ? LIMIT 1`,
      [id]
    );
    return rows[0] ?? null;
  }

  async porDocumento(numero: string): Promise<UsuarioRow | null> {
    const [rows] = await pool.query<UsuarioRow[]>(
      `${SELECT_USUARIO} WHERE u.numero_documento = ? LIMIT 1`,
      [numero]
    );
    return rows[0] ?? null;
  }

  async idRol(nombre: RolUsuario): Promise<number | null> {
    const [rows] = await pool.query<Fila[]>(
      'SELECT id_rol FROM tbl_roles WHERE nombre_rol = ? LIMIT 1',
      [nombre]
    );
    return rows[0] ? Number(rows[0].id_rol) : null;
  }

  async crear(
    datos: {
      id_rol: number;
      nombres: string;
      apellidos: string;
      tipo_documento: string;
      numero_documento: string;
      email: string;
      password_hash: string;
      telefono: string;
      direccion?: string | null;
    },
    conexion?: Conexion
  ): Promise<number> {
    const [resultado] = await (conexion ?? pool).execute<ResultadoEscritura>(
      `INSERT INTO tbl_usuarios
         (id_rol, nombres, apellidos, tipo_documento, numero_documento,
          email, password_hash, telefono, direccion)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING id_usuario AS "insertId"`,
      [
        datos.id_rol,
        datos.nombres,
        datos.apellidos,
        datos.tipo_documento,
        datos.numero_documento,
        datos.email,
        datos.password_hash,
        datos.telefono,
        datos.direccion ?? null
      ]
    );
    return resultado.insertId;
  }

  async registrarAcceso(id: number): Promise<void> {
    await pool.execute('UPDATE tbl_usuarios SET ultimo_acceso = NOW() WHERE id_usuario = ?', [id]);
  }

  async listar(rol?: string): Promise<UsuarioRow[]> {
    const [rows] = await pool.query<UsuarioRow[]>(
      `${SELECT_USUARIO} ${rol ? 'WHERE r.nombre_rol = ?' : ''} ORDER BY u.fecha_registro DESC`,
      rol ? [rol] : []
    );
    return rows;
  }

  /** Guarda un nuevo hash de contraseña. `temporal` = la puso soporte y debe cambiarse al entrar. */
  async cambiarPassword(id: number, hash: string, temporal: boolean, conexion?: Conexion): Promise<void> {
    await (conexion ?? pool).execute(
      'UPDATE tbl_usuarios SET password_hash = ?, debe_cambiar_password = ? WHERE id_usuario = ?',
      [hash, temporal ? 1 : 0, id]
    );
  }

  async cambiarEstado(id: number, estado: string): Promise<void> {
    await pool.execute('UPDATE tbl_usuarios SET estado = ? WHERE id_usuario = ?', [estado, id]);
  }

  async actualizar(id: number, campos: Record<string, string | number | null>): Promise<void> {
    const columnas = Object.keys(campos);
    if (columnas.length === 0) return;
    await pool.execute(
      `UPDATE tbl_usuarios SET ${columnas.map(c => `${c} = ?`).join(', ')} WHERE id_usuario = ?`,
      [...Object.values(campos), id]
    );
  }
}

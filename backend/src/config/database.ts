import { Pool, PoolClient, QueryResult, types } from 'pg';

/*
 * Conexión a PostgreSQL en Supabase.
 * DATABASE_URL (variable de entorno en Vercel) = cadena del "Transaction pooler" de Supabase.
 */

// COUNT/SUM devuelven BIGINT y NUMERIC: pg los entrega como texto; aquí se convierten a número.
types.setTypeParser(types.builtins.INT8, valor => Number(valor));
types.setTypeParser(types.builtins.NUMERIC, valor => Number(valor));

const urlConexion = process.env.DATABASE_URL;

if (!urlConexion) {
  throw new Error('Falta la variable de entorno DATABASE_URL (cadena de conexión de Supabase).');
}

const poolPg = new Pool({
  connectionString: urlConexion,
  ssl: { rejectUnauthorized: false },
  // En Vercel cada instancia es efímera: pocas conexiones y cierre rápido de las inactivas.
  max: 5,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 10_000
});

poolPg.on('error', error => console.error('Error inesperado en el pool de PostgreSQL:', error));

/** Una fila cualquiera devuelta por un SELECT. */
export interface Fila {
  [columna: string]: any;
}

/** Resultado de un INSERT / UPDATE / DELETE. */
export interface ResultadoEscritura {
  affectedRows: number;
  /** Solo si el INSERT termina en `RETURNING <id> AS "insertId"`. */
  insertId: number;
}

/** Convierte los `?` de la consulta en `$1, $2, ...` (formato de PostgreSQL). */
function aParametrosPg(sql: string): string {
  let n = 0;
  return sql.replace(/\?/g, () => `$${++n}`);
}

/**
 * Envoltorio mínimo sobre `pg` con la forma `const [filas] = await db.query(sql, params)`.
 * SELECT devuelve las filas; INSERT/UPDATE/DELETE devuelven `{ affectedRows, insertId }`.
 */
export class Conexion {
  constructor(private readonly cliente: Pool | PoolClient) {}

  async query<T extends Fila[] | ResultadoEscritura = Fila[]>(
    sql: string,
    params: unknown[] = []
  ): Promise<[T]> {
    const resultado: QueryResult = await this.cliente.query(aParametrosPg(sql), params);

    if (resultado.command === 'INSERT' || resultado.command === 'UPDATE' || resultado.command === 'DELETE') {
      const escritura: ResultadoEscritura = {
        affectedRows: resultado.rowCount ?? 0,
        insertId: Number(resultado.rows[0]?.insertId ?? 0)
      };
      return [escritura as T];
    }

    return [resultado.rows as T];
  }

  /** Alias de `query` (mismo comportamiento). */
  execute<T extends Fila[] | ResultadoEscritura = Fila[]>(sql: string, params: unknown[] = []): Promise<[T]> {
    return this.query<T>(sql, params);
  }
}

export const pool = new Conexion(poolPg);

/** Ejecuta `fn` dentro de una transacción (commit si todo sale bien, rollback si falla). */
export async function conTransaccion<T>(fn: (conexion: Conexion) => Promise<T>): Promise<T> {
  const cliente = await poolPg.connect();

  try {
    await cliente.query('BEGIN');
    const resultado = await fn(new Conexion(cliente));
    await cliente.query('COMMIT');
    return resultado;
  } catch (error) {
    await cliente.query('ROLLBACK');
    throw error;
  } finally {
    cliente.release();
  }
}

/**
 * Búsqueda sin distinguir mayúsculas ni tildes ("valvula" encuentra "Válvula").
 * Uso: `${contiene('p.nombre')}` con el texto en params.
 */
export function contiene(columna: string): string {
  const quitarTildes = (expr: string) => `TRANSLATE(${expr}, 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN')`;
  return `${quitarTildes(columna)} ILIKE ${quitarTildes('?')}`;
}

/** Código de PostgreSQL para "valor duplicado" (viola un índice UNIQUE). */
export const PG_VALOR_DUPLICADO = '23505';

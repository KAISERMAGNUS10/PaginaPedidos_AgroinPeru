import './env';
import mysql, { PoolConnection, RowDataPacket } from 'mysql2/promise';

export const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,

  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,

  // Todo se maneja en UTC: MySQL guarda UTC y la API responde fechas ISO (UTC).
  timezone: 'Z',
  decimalNumbers: true,
  charset: 'utf8mb4',
  multipleStatements: true
});

// Cada conexión nueva trabaja en UTC y con juego de caracteres UTF-8 completo.
(pool as any).on('connection', (conexion: any) => {
  conexion.query("SET time_zone = '+00:00'");
  conexion.query("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");
});

/** Ejecuta `fn` dentro de una transacción (commit si todo sale bien, rollback si falla). */
export async function conTransaccion<T>(
  fn: (conexion: PoolConnection) => Promise<T>
): Promise<T> {
  const conexion = await pool.getConnection();

  try {
    await conexion.beginTransaction();
    const resultado = await fn(conexion);
    await conexion.commit();
    return resultado;
  } catch (error) {
    await conexion.rollback();
    throw error;
  } finally {
    conexion.release();
  }
}

export async function testDatabaseConnection(): Promise<void> {
  const conexion = await pool.getConnection();
  console.log('✅ Conexión a MySQL establecida correctamente');
  conexion.release();
}

async function columnaExiste(tabla: string, columna: string): Promise<boolean> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS n
       FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?`,
    [tabla, columna]
  );
  return Number(rows[0].n) > 0;
}

/**
 * Deja la BD lista para la API sin que tengas que correr scripts extra:
 *  - agrega 2 columnas pequeñas que el frontend necesita y amplía codigo_sku a 80
 *  - garantiza los 4 roles y una tienda de recojo por defecto
 */
export async function asegurarEsquema(): Promise<void> {
  if (!(await columnaExiste('tbl_pedidos', 'fecha_cancelacion'))) {
    await pool.query('ALTER TABLE tbl_pedidos ADD COLUMN fecha_cancelacion DATETIME NULL');
    console.log('🛠  Columna tbl_pedidos.fecha_cancelacion creada');
  }

  if (!(await columnaExiste('tbl_notificaciones', 'mostrado_toast'))) {
    await pool.query(
      'ALTER TABLE tbl_notificaciones ADD COLUMN mostrado_toast TINYINT(1) NOT NULL DEFAULT 0'
    );
    console.log('🛠  Columna tbl_notificaciones.mostrado_toast creada');
  }

  // Algunos SKU del catálogo del frontend miden hasta 57 caracteres (la columna original era VARCHAR(50)).
  const [sku] = await pool.query<RowDataPacket[]>(
    `SELECT CHARACTER_MAXIMUM_LENGTH AS n
       FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'tbl_productos'
        AND COLUMN_NAME = 'codigo_sku'`
  );
  if (sku[0] && Number(sku[0].n) < 80) {
    await pool.query('ALTER TABLE tbl_productos MODIFY codigo_sku VARCHAR(80) NOT NULL');
    console.log('🛠  Columna tbl_productos.codigo_sku ampliada a VARCHAR(80)');
  }

  // Módulo de COMPRAS (ingreso de mercadería): no existía en el script original.
  await pool.query(
    `CREATE TABLE IF NOT EXISTS tbl_compras (
       id_compra INT NOT NULL AUTO_INCREMENT,
       codigo_compra VARCHAR(30) NOT NULL,
       id_usuario INT NOT NULL,
       proveedor_nombre VARCHAR(150) NOT NULL,
       proveedor_ruc VARCHAR(20) DEFAULT NULL,
       tipo_comprobante VARCHAR(20) NOT NULL DEFAULT 'FACTURA',
       numero_comprobante VARCHAR(40) DEFAULT NULL,
       ubicacion_destino VARCHAR(20) NOT NULL DEFAULT 'ALMACEN',
       subtotal DECIMAL(10,2) NOT NULL,
       igv DECIMAL(10,2) NOT NULL,
       total DECIMAL(10,2) NOT NULL,
       estado VARCHAR(20) NOT NULL DEFAULT 'REGISTRADA' COMMENT 'REGISTRADA / ANULADA',
       observaciones VARCHAR(255) DEFAULT NULL,
       fecha_compra TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
       fecha_anulacion DATETIME DEFAULT NULL,
       PRIMARY KEY (id_compra),
       UNIQUE KEY codigo_compra (codigo_compra),
       KEY fk_compra_usuario (id_usuario),
       KEY idx_compras_fecha (fecha_compra),
       CONSTRAINT fk_compra_usuario FOREIGN KEY (id_usuario)
         REFERENCES tbl_usuarios (id_usuario) ON DELETE RESTRICT ON UPDATE CASCADE
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
       COMMENT='Compras a proveedores (ingreso de mercadería)'`
  );

  await pool.query(
    `CREATE TABLE IF NOT EXISTS tbl_detalle_compras (
       id_detalle_compra INT NOT NULL AUTO_INCREMENT,
       id_compra INT NOT NULL,
       id_producto INT NOT NULL,
       cantidad INT NOT NULL,
       costo_unitario DECIMAL(10,2) NOT NULL,
       subtotal DECIMAL(10,2) NOT NULL,
       PRIMARY KEY (id_detalle_compra),
       KEY fk_detcompra_compra (id_compra),
       KEY fk_detcompra_producto (id_producto),
       CONSTRAINT fk_detcompra_compra FOREIGN KEY (id_compra)
         REFERENCES tbl_compras (id_compra) ON DELETE CASCADE ON UPDATE CASCADE,
       CONSTRAINT fk_detcompra_producto FOREIGN KEY (id_producto)
         REFERENCES tbl_productos (id_producto) ON DELETE RESTRICT ON UPDATE CASCADE
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
       COMMENT='Detalle de productos por compra'`
  );

  await pool.query(
    `INSERT IGNORE INTO tbl_roles (nombre_rol, descripcion) VALUES
       ('ADMIN',   'Administrador del sistema'),
       ('CAJA',    'Cajero: cobra los pedidos'),
       ('PICKING', 'Almacenero: prepara y entrega pedidos'),
       ('CLIENTE', 'Cliente de la tienda web')`
  );

  const [tiendas] = await pool.query<RowDataPacket[]>(
    'SELECT COUNT(*) AS n FROM tbl_tiendas_recojo'
  );

  if (Number(tiendas[0].n) === 0) {
    await pool.query(
      `INSERT INTO tbl_tiendas_recojo
         (codigo_tienda, nombre_tienda, direccion, distrito, ciudad, departamento, telefono_contacto)
       VALUES
         ('TIENDA-001', 'AGROINPERU - Lima Industrial',
          'Av. República de Argentina N° 327, Urb. Lima Industrial',
          'Cercado de Lima', 'Lima', 'Lima', '934757123 / 934665464')`
    );
    console.log('🛠  Tienda de recojo por defecto creada');
  }
}

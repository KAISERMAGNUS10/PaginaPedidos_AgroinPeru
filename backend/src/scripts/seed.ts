import '../config/env';

import fs from 'fs';
import path from 'path';
import { RowDataPacket } from 'mysql2/promise';

import { asegurarEsquema, pool } from '../config/database';

/*
|--------------------------------------------------------------------------
| Seed: deja la BD lista para probar la plataforma completa de AGROINPERU
|--------------------------------------------------------------------------
| - Ejecuta el script SQL completo UTF-8 (database/seed_pruebas_agroinperu.sql)
| - Siembra 11 categorías y 401 productos reales con imágenes y stock
| - Cuentas de prueba con roles (Admin, Caja, Picking, Clientes)
| - Pedidos de ejemplo con estados reales (Vigente, Preparación, Listo, Pagado, etc.)
| - Pagos en caja, kardex de inventario, compras a proveedores y notificaciones
|
| Uso:  npm run seed
*/

async function main(): Promise<void> {
  try {
    console.log('🛠  Asegurando estructura y esquema de base de datos...');
    await asegurarEsquema();

    const sqlPath = path.resolve(__dirname, '../../database/seed_pruebas_agroinperu.sql');
    if (!fs.existsSync(sqlPath)) {
      throw new Error(`No se encontró el archivo de seed en: ${sqlPath}`);
    }

    console.log('📦 Cargando seed completo de pruebas (UTF-8)...');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');

    // Ejecutar statements del archivo SQL
    await pool.query('SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci');
    await pool.query(sqlContent);

    const [cats] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) AS n FROM tbl_categorias');
    const [prods] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) AS n FROM tbl_productos');
    const [pedidos] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) AS n FROM tbl_pedidos');
    const [usuarios] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) AS n FROM tbl_usuarios');
    const [compras] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) AS n FROM tbl_compras');

    console.log('\n======================================================');
    console.log('✅ BASE DE DATOS SEMBRADA CON ÉXITO');
    console.log('======================================================');
    console.log(`   - Categorías:       ${cats[0].n}`);
    console.log(`   - Productos:        ${prods[0].n} (todos con imágenes existentes)`);
    console.log(`   - Usuarios:         ${usuarios[0].n}`);
    console.log(`   - Pedidos de prueba: ${pedidos[0].n}`);
    console.log(`   - Compras stock:    ${compras[0].n}`);
    console.log('------------------------------------------------------');
    console.log('🔑 CUENTAS DE ACCESO PARA PRUEBAS:');
    console.log('   Rol      Email                  Contraseña');
    console.log('   ADMIN    admin@agroinperu.com    Admin1234');
    console.log('   CAJA     caja@agroinperu.com     Caja1234');
    console.log('   PICKING  picking@agroinperu.com  Picking1234');
    console.log('   CLIENTE  cliente@agroinperu.com  Cliente1234');
    console.log('   (También disponibles con dominio @agroinperu.pe)');
    console.log('======================================================\n');
  } catch (error) {
    console.error('❌ Error en el seed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

void main();

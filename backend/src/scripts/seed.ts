import '../config/env';

import fs from 'fs';
import path from 'path';

import { ejecutarScript, Fila, pool } from '../config/database';

/*
|--------------------------------------------------------------------------
| Seed: crea las tablas y carga los datos de prueba en PostgreSQL
|--------------------------------------------------------------------------
| Ejecuta database/agroinperu_postgresql.sql contra DATABASE_URL.
| Es lo mismo que pegar ese archivo en el SQL Editor de Supabase.
| ⚠ Borra y vuelve a crear todas las tablas.
|
| Uso:  npm run seed
*/

async function main(): Promise<void> {
  try {
    const sqlPath = path.resolve(__dirname, '../../database/agroinperu_postgresql.sql');
    if (!fs.existsSync(sqlPath)) {
      throw new Error(`No se encontró el archivo SQL en: ${sqlPath}`);
    }

    console.log('📦 Creando tablas y cargando datos de prueba...');
    await ejecutarScript(fs.readFileSync(sqlPath, 'utf8'));

    const [[conteo]] = await pool.query<Fila[]>(
      `SELECT (SELECT COUNT(*) FROM tbl_categorias) AS categorias,
              (SELECT COUNT(*) FROM tbl_productos)  AS productos,
              (SELECT COUNT(*) FROM tbl_usuarios)   AS usuarios,
              (SELECT COUNT(*) FROM tbl_pedidos)    AS pedidos,
              (SELECT COUNT(*) FROM tbl_compras)    AS compras`
    );

    console.log('\n======================================================');
    console.log('✅ BASE DE DATOS SEMBRADA CON ÉXITO');
    console.log('======================================================');
    console.log(`   - Categorías:        ${conteo.categorias}`);
    console.log(`   - Productos:         ${conteo.productos}`);
    console.log(`   - Usuarios:          ${conteo.usuarios}`);
    console.log(`   - Pedidos de prueba: ${conteo.pedidos}`);
    console.log(`   - Compras stock:     ${conteo.compras}`);
    console.log('------------------------------------------------------');
    console.log('🔑 CUENTAS DE ACCESO PARA PRUEBAS:');
    console.log('   Rol      Email                   Contraseña');
    console.log('   ADMIN    admin@agroinperu.com    Admin1234');
    console.log('   CAJA     caja@agroinperu.com     Caja1234');
    console.log('   PICKING  picking@agroinperu.com  Picking1234');
    console.log('   CLIENTE  cliente@agroinperu.com  Cliente1234');
    console.log('======================================================\n');
  } catch (error) {
    console.error('❌ Error en el seed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

void main();

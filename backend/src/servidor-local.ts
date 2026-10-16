import './config/env';

import app from './app';
import { pool, testDatabaseConnection } from './config/database';
import { expirarVencidos } from './services/expiracion.service';

/*
 * Servidor para desarrollo local (npm run dev / npm start).
 * En Vercel no se usa este archivo: Vercel importa directamente `src/app.ts`.
 */
const PORT = Number(process.env.PORT) || 3000;

async function iniciarServidor(): Promise<void> {
  try {
    await testDatabaseConnection();
    await expirarVencidos(true);

    // Revisa cada 5 minutos los pedidos que superaron las 48 horas.
    // (En Vercel no hay temporizadores: los servicios llaman a expirarVencidos() en cada consulta.)
    setInterval(() => void expirarVencidos(true), 5 * 60 * 1000).unref();

    const servidor = app.listen(PORT, () => {
      console.log(`🚀 Servidor ejecutándose en http://localhost:${PORT}`);
      console.log(`   Health check: http://localhost:${PORT}/api/health`);
    });

    const cerrar = () => {
      servidor.close(() => void pool.end().then(() => process.exit(0)));
    };
    process.on('SIGINT', cerrar);
    process.on('SIGTERM', cerrar);
  } catch (error) {
    console.error('❌ No fue posible iniciar el servidor');
    console.error(error);
    process.exit(1);
  }
}

void iniciarServidor();

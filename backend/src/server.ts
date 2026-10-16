import './config/env';

import app from './app';
import { asegurarEsquema, pool, testDatabaseConnection } from './config/database';
import { expirarVencidos } from './services/expiracion.service';

const PORT = Number(process.env.PORT) || 3000;

async function iniciarServidor(): Promise<void> {
  try {
    await testDatabaseConnection();
    await asegurarEsquema();
    await expirarVencidos(true);

    // Revisa cada 5 minutos los pedidos que superaron las 48 horas.
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

import './env';
import { CorsOptions } from 'cors';

const origenesPermitidos = (process.env.FRONTEND_URL ?? 'http://localhost:4200')
  .split(',')
  .map(origen => origen.trim())
  .filter(Boolean);

export const corsOptions: CorsOptions = {
  origin(origin, callback) {
    // Postman, curl y peticiones servidor-servidor no envían Origin.
    if (!origin || origenesPermitidos.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error('ORIGEN_NO_PERMITIDO'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

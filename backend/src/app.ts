import express, { Application, Request, Response } from 'express';

import { manejarErrorGlobal } from './middlewares/error.middleware';
import { rutaNoEncontrada } from './middlewares/not-found.middleware';

import authRoutes from './routes/auth.routes';
import cajaRoutes from './routes/caja.routes';
import carritoRoutes from './routes/carrito.routes';
import compraRoutes from './routes/compra.routes';
import dashboardRoutes from './routes/dashboard.routes';
import inventarioRoutes from './routes/inventario.routes';
import notificacionRoutes from './routes/notificacion.routes';
import pedidoRoutes from './routes/pedido.routes';
import pickingRoutes from './routes/picking.routes';
import publicRoutes from './routes/public.routes';
import reporteRoutes from './routes/reporte.routes';
import soporteRoutes from './routes/soporte.routes';
import usuarioRoutes from './routes/usuario.routes';

const app: Application = express();

app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

app.get('/api/health', (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'API de AGROINPERU (Pedidos) funcionando correctamente'
  });
});

app.use('/api/public', publicRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/carrito', carritoRoutes);
app.use('/api/pedidos', pedidoRoutes);
app.use('/api/notificaciones', notificacionRoutes);
app.use('/api/caja', cajaRoutes);
app.use('/api/picking', pickingRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/inventario', inventarioRoutes);
app.use('/api/usuarios', usuarioRoutes);
app.use('/api/compras', compraRoutes);
app.use('/api/reportes', reporteRoutes);
app.use('/api/soporte', soporteRoutes);

// 404 y errores: SIEMPRE al final.
app.use(rutaNoEncontrada);
app.use(manejarErrorGlobal);

export default app;

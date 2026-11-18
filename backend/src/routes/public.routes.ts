import { NextFunction, Request, Response, Router } from 'express';

import {
  detalleProducto,
  listarCategorias,
  listarProductos,
  listarTiendas
} from '../controllers/public.controller';

const router = Router();

/**
 * El catálogo es público y cambia poco: la CDN de Vercel guarda la respuesta 60 s
 * (y hasta 5 min mientras la renueva por detrás). Así la tienda carga al instante.
 * El stock real se vuelve a validar en el backend al confirmar el pedido.
 */
function cacheCatalogo(_req: Request, res: Response, next: NextFunction): void {
  res.set('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=300');
  next();
}

router.get('/productos', cacheCatalogo, listarProductos);
router.get('/productos/:sku', cacheCatalogo, detalleProducto);
router.get('/categorias', cacheCatalogo, listarCategorias);
router.get('/tiendas', cacheCatalogo, listarTiendas);

export default router;

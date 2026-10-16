import { Router } from 'express';

import {
  detalleProducto,
  listarCategorias,
  listarProductos,
  listarTiendas
} from '../controllers/public.controller';

const router = Router();

router.get('/productos', listarProductos);
router.get('/productos/:sku', detalleProducto);
router.get('/categorias', listarCategorias);
router.get('/tiendas', listarTiendas);

export default router;

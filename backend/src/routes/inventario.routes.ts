import { Router } from 'express';

import { actualizarProducto, crearProducto, listarStock, movimientos, registrarMovimiento } from '../controllers/inventario.controller';
import { soloAdmin, verificarToken } from '../middlewares/auth.middleware';

const router = Router();

router.use(verificarToken, soloAdmin);

router.get('/', listarStock);
router.get('/movimientos', movimientos);
router.post('/movimientos', registrarMovimiento);
router.post('/productos', crearProducto);
router.put('/productos/:sku', actualizarProducto);

export default router;

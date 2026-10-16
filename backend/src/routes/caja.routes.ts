import { Router } from 'express';

import { buscar, detalleVenta, pagar, pendientes, ventas } from '../controllers/caja.controller';
import { requerirRol, verificarToken } from '../middlewares/auth.middleware';

const router = Router();

router.use(verificarToken, requerirRol('CAJA'));

router.get('/pendientes', pendientes);
router.get('/buscar', buscar);
router.post('/pedidos/:codigo/pagar', pagar);
router.get('/ventas', ventas);
router.get('/ventas/:codigo', detalleVenta);

export default router;

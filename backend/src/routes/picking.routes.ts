import { Router } from 'express';

import {
  entregar,
  historial,
  marcarListo,
  pendientes,
  porEntregar,
  progreso
} from '../controllers/picking.controller';
import { requerirRol, verificarToken } from '../middlewares/auth.middleware';

const router = Router();

router.use(verificarToken, requerirRol('PICKING'));

router.get('/pendientes', pendientes);
router.get('/por-entregar', porEntregar);
router.get('/historial', historial);
router.patch('/pedidos/:codigo/progreso', progreso);
router.post('/pedidos/:codigo/listo', marcarListo);
router.post('/pedidos/:codigo/entregar', entregar);

export default router;

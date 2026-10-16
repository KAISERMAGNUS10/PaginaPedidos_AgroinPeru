import { Router } from 'express';

import { anular, crear, detalle, listar } from '../controllers/compra.controller';
import { soloAdmin, verificarToken } from '../middlewares/auth.middleware';

const router = Router();
router.use(verificarToken, soloAdmin);

router.get('/', listar);
router.post('/', crear);
router.get('/:codigo', detalle);
router.patch('/:codigo/anular', anular);

export default router;

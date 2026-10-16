import { Router } from 'express';

import { reiniciarDemo, resumen } from '../controllers/dashboard.controller';
import { soloAdmin, verificarToken } from '../middlewares/auth.middleware';

const router = Router();

router.use(verificarToken, soloAdmin);

router.get('/', resumen);
router.post('/reiniciar-demo', reiniciarDemo);

export default router;

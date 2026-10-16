import { Router } from 'express';

import { generar } from '../controllers/reporte.controller';
import { soloAdmin, verificarToken } from '../middlewares/auth.middleware';

const router = Router();
router.use(verificarToken, soloAdmin);
router.get('/', generar);

export default router;

import { Router } from 'express';

import { listar, rechazar, restablecer } from '../controllers/soporte.controller';
import { requerirRol, verificarToken } from '../middlewares/auth.middleware';

const router = Router();

router.use(verificarToken, requerirRol('SOPORTE'));

router.get('/solicitudes', listar);
router.post('/solicitudes/:id/restablecer', restablecer);
router.post('/solicitudes/:id/rechazar', rechazar);

export default router;

import { Router } from 'express';

import { cambiarPassword, login, perfil, registro, solicitarRecuperacion } from '../controllers/auth.controller';
import { verificarToken } from '../middlewares/auth.middleware';

const router = Router();

router.post('/login', login);
router.post('/registro', registro);
router.post('/recuperar', solicitarRecuperacion);
router.get('/me', verificarToken, perfil);
router.put('/password', verificarToken, cambiarPassword);

export default router;

import { Router } from 'express';

import { login, perfil, registro } from '../controllers/auth.controller';
import { verificarToken } from '../middlewares/auth.middleware';

const router = Router();

router.post('/login', login);
router.post('/registro', registro);
router.get('/me', verificarToken, perfil);

export default router;

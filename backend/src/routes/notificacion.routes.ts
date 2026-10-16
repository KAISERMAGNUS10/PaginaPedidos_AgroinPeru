import { Router } from 'express';

import { listar, marcarLeidas, marcarToastMostrado } from '../controllers/notificacion.controller';
import { soloClientes, verificarToken } from '../middlewares/auth.middleware';

const router = Router();

router.use(verificarToken, soloClientes);

router.get('/', listar);
router.patch('/leidas', marcarLeidas);
router.patch('/toast-mostrado', marcarToastMostrado);
router.patch('/:id/leida', marcarLeidas);

export default router;

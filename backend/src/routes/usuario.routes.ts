import { Router } from 'express';

import { actualizar, cambiarEstado, crearPersonal, listar } from '../controllers/usuario.controller';
import { soloAdmin, verificarToken } from '../middlewares/auth.middleware';

const router = Router();

router.use(verificarToken, soloAdmin);

router.get('/', listar);
router.post('/', crearPersonal);
router.patch('/:id/estado', cambiarEstado);
router.put('/:id', actualizar);

export default router;

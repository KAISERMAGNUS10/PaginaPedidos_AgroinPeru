import { Router } from 'express';

import {
  agregar,
  fijarCantidad,
  obtener,
  quitar,
  reemplazar,
  vaciar
} from '../controllers/carrito.controller';
import { soloClientes, verificarToken } from '../middlewares/auth.middleware';

const router = Router();

router.use(verificarToken, soloClientes);

router.get('/', obtener);
router.put('/', reemplazar);
router.delete('/', vaciar);
router.post('/items', agregar);
router.put('/items/:sku', fijarCantidad);
router.delete('/items/:sku', quitar);

export default router;

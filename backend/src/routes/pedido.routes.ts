import { Router } from 'express';

import {
  cancelar,
  crear,
  fijarPersona,
  misPedidos,
  obtener,
  quitarPersona
} from '../controllers/pedido.controller';
import { soloClientes, verificarToken } from '../middlewares/auth.middleware';

const router = Router();

router.use(verificarToken);

// Solo clientes
router.post('/', soloClientes, crear);
router.get('/mis-pedidos', soloClientes, misPedidos);
router.patch('/:codigo/cancelar', soloClientes, cancelar);
router.put('/:codigo/persona-autorizada', soloClientes, fijarPersona);
router.delete('/:codigo/persona-autorizada', soloClientes, quitarPersona);

// Cliente (solo el suyo) o personal (cualquiera)
router.get('/:codigo', obtener);

export default router;

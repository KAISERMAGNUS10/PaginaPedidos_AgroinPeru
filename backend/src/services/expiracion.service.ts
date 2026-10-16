import { conTransaccion } from '../config/database';
import { NotificacionRepository } from '../repositories/notificacion.repository';
import { PedidoRepository } from '../repositories/pedido.repository';
import { InventarioService } from './inventario.service';

const repoPedido = new PedidoRepository();
const repoNotif = new NotificacionRepository();
const inventario = new InventarioService();

let ultimaEjecucion = 0;

/**
 * RF11: un pedido vence a las 48 h. Pasa a EXPIRADO y devuelve el stock reservado.
 * Se llama antes de las consultas de pedidos, caja, picking, dashboard y reportes
 * (con límite de frecuencia para no saturar la BD).
 */
export async function expirarVencidos(forzar = false): Promise<number> {
  if (!forzar && Date.now() - ultimaEjecucion < 15_000) return 0;
  ultimaEjecucion = Date.now();

  let expirados = 0;

  try {
    const ids = await repoPedido.idsVencidos();

    for (const id of ids) {
      await conTransaccion(async conexion => {
        const pedido = await repoPedido.bloquearPorId(conexion, id);

        if (
          !pedido ||
          !['VIGENTE', 'LISTO_PARA_RECOJO', 'EN_PREPARACION'].includes(pedido.estado) ||
          new Date(pedido.fecha_expiracion).getTime() > Date.now()
        ) {
          return;
        }

        await inventario.restaurarPedido(
          conexion,
          id,
          pedido.id_usuario,
          `Devolución por expiración del pedido ${pedido.codigo_ticket}`
        );

        await repoPedido.cambiarEstado(conexion, id, 'EXPIRADO');

        await repoNotif.crear(
          {
            id_usuario: pedido.id_usuario,
            id_pedido: id,
            titulo: 'Pedido expirado',
            mensaje: `Tu pedido ${pedido.codigo_ticket} superó las 48 horas de vigencia y fue anulado.`,
            tipo: 'ALERTA'
          },
          conexion
        );

        expirados++;
      });
    }
  } catch (error) {
    console.error('Error al expirar pedidos vencidos:', error);
  }

  return expirados;
}

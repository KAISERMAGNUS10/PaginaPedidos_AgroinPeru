import { conTransaccion } from '../config/database';
import { NotificacionRepository } from '../repositories/notificacion.repository';
import { PedidoRepository } from '../repositories/pedido.repository';
import { PickingRepository } from '../repositories/picking.repository';
import { badRequest, conflicto, noEncontrado } from '../utils/errores';
import { finDelDia, inicioDelDia } from '../utils/fechas';
import { expirarVencidos } from './expiracion.service';

const repoPedido = new PedidoRepository();
const repoPicking = new PickingRepository();
const repoNotif = new NotificacionRepository();

export class PickingService {
  /** Pedidos por preparar (VIGENTE), el más antiguo primero. */
  async pendientes() {
    await expirarVencidos();
    return repoPedido.tickets({
      where: "p.estado = 'VIGENTE'",
      orderBy: 'p.fecha_emision ASC, p.id_pedido ASC'
    });
  }

  /** Pedidos pagados esperando que el almacenero los entregue. */
  async porEntregar() {
    await expirarVencidos();
    return repoPedido.tickets({
      where: "p.estado = 'PAGADO'",
      orderBy: 'pg.fecha_pago ASC'
    });
  }

  async historial(desde?: string, hasta?: string) {
    const d = inicioDelDia(desde);
    const h = finDelDia(hasta);

    const where = ["p.estado = 'ENTREGADO'"];
    const params: unknown[] = [];

    if (d) {
      where.push('pk.fecha_entrega >= ?');
      params.push(d);
    }
    if (h) {
      where.push('pk.fecha_entrega <= ?');
      params.push(h);
    }

    const entregados = await repoPedido.tickets({
      where: where.join(' AND '),
      params,
      orderBy: 'pk.fecha_entrega DESC'
    });

    return {
      totalPedidos: entregados.length,
      totalUnidades: entregados.reduce(
        (a, t) => a + t.productos.reduce((s, i) => s + i.cantidad, 0),
        0
      ),
      pedidos: entregados
    };
  }

  /** (Opcional) guarda cuántos ítems lleva separados el almacenero. */
  async registrarProgreso(idAlmacenero: number, codigo: string, items: unknown) {
    const n = Number(items);
    if (!Number.isInteger(n) || n < 0) {
      throw badRequest('ITEMS_INVALIDOS', 'items debe ser un entero >= 0.');
    }

    const idPedido = await repoPedido.idPorCodigo(codigo);
    if (!idPedido) throw noEncontrado('PEDIDO_NO_ENCONTRADO', 'No se encontró el pedido.');

    await repoPicking.actualizarProgreso(idPedido, idAlmacenero, n);
    return (await repoPedido.ticketPorCodigo(codigo))!;
  }

  /** VIGENTE -> LISTO_PARA_RECOJO + notificación al cliente. */
  async marcarListo(idAlmacenero: number, codigo: string) {
    await expirarVencidos(true);

    await conTransaccion(async conexion => {
      const pedido = await repoPedido.bloquearPorCodigo(conexion, codigo);
      if (!pedido) throw noEncontrado('PEDIDO_NO_ENCONTRADO', 'No se encontró el pedido.');

      if (pedido.estado !== 'VIGENTE') {
        throw conflicto(
          'ESTADO_INVALIDO',
          `El pedido está ${pedido.estado} y no puede marcarse como listo para recojo.`
        );
      }

      await repoPedido.cambiarEstado(conexion, pedido.id_pedido, 'LISTO_PARA_RECOJO');
      await repoPicking.marcarListo(conexion, pedido.id_pedido, idAlmacenero);

      await repoNotif.crear(
        {
          id_usuario: pedido.id_usuario,
          id_pedido: pedido.id_pedido,
          titulo: 'Pedido listo para recojo',
          mensaje: `Tu pedido ${pedido.codigo_ticket} ya está listo para recojo. Acércate a caja para cancelarlo y recogerlo.`,
          tipo: 'EXITO'
        },
        conexion
      );
    });

    return (await repoPedido.ticketPorCodigo(codigo))!;
  }

  /** PAGADO -> ENTREGADO. */
  async entregar(idAlmacenero: number, codigo: string) {
    await conTransaccion(async conexion => {
      const pedido = await repoPedido.bloquearPorCodigo(conexion, codigo);
      if (!pedido) throw noEncontrado('PEDIDO_NO_ENCONTRADO', 'No se encontró el pedido.');

      if (pedido.estado !== 'PAGADO') {
        throw conflicto('ESTADO_INVALIDO', 'Este pedido ya no está en estado PAGADO.');
      }

      const persona = pedido.persona_autorizada_recojo
        ? { nombre: pedido.persona_autorizada_recojo, dni: pedido.dni_autorizado_recojo }
        : {
            nombre: pedido.razon_social_nombre,
            dni: pedido.tipo_documento_comprobante === 'DNI' ? pedido.numero_documento_comprobante : null
          };

      await repoPedido.cambiarEstado(conexion, pedido.id_pedido, 'ENTREGADO');
      await repoPicking.marcarEntregado(conexion, pedido.id_pedido, idAlmacenero, persona);
    });

    return (await repoPedido.ticketPorCodigo(codigo))!;
  }
}

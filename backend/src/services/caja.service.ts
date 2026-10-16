import { conTransaccion } from '../config/database';
import { PagoDto } from '../models/pedido.model';
import { PagoRepository } from '../repositories/pago.repository';
import { PedidoRepository } from '../repositories/pedido.repository';
import { badRequest, conflicto, noEncontrado } from '../utils/errores';
import { finDelDia, inicioDelDia, redondear2 } from '../utils/fechas';
import { texto } from '../utils/validadores';
import { expirarVencidos } from './expiracion.service';

const repoPedido = new PedidoRepository();
const repoPago = new PagoRepository();

type MetodoBD = 'EFECTIVO' | 'TARJETA_DEBITO' | 'TARJETA_CREDITO' | 'YAPE' | 'PLIN' | 'TRANSFERENCIA';

function normalizarMetodo(valor: unknown): MetodoBD {
  const v = texto(valor).toLowerCase();

  if (v === 'efectivo') return 'EFECTIVO';
  if (v.startsWith('tarjeta')) return v.includes('créd') || v.includes('cred') ? 'TARJETA_CREDITO' : 'TARJETA_DEBITO';
  if (v === 'yape' || v === 'yape/plin') return 'YAPE';
  if (v === 'plin') return 'PLIN';
  if (v === 'transferencia') return 'TRANSFERENCIA';

  throw badRequest('METODO_PAGO_INVALIDO', 'Método de pago: Efectivo, Tarjeta o Yape/Plin.');
}

export class CajaService {
  /**
   * RF22: busca por N° de ticket (exacto) y, si no hay, por DNI / RUC del comprobante.
   * Devuelve una lista: 0 = no encontrado, 1 = mostrar directo, varios = elegir.
   */
  async buscar(consulta: unknown) {
    const q = texto(consulta);
    if (!q) throw badRequest('BUSQUEDA_VACIA', 'Ingresa un ticket, DNI o RUC para buscar.');

    await expirarVencidos();

    // Los tickets se guardan en mayúsculas (TK-2026-00001): la búsqueda no distingue mayúsculas.
    const porTicket = await repoPedido.tickets({ where: 'p.codigo_ticket = ?', params: [q.toUpperCase()] });
    if (porTicket.length > 0) return porTicket;

    return repoPedido.tickets({ where: 'p.numero_documento_comprobante = ?', params: [q] });
  }

  /** Cola de cobro: pedidos que almacén ya dejó LISTOS (el más antiguo primero). */
  async pendientes() {
    await expirarVencidos();
    return repoPedido.tickets({
      where: "p.estado = 'LISTO_PARA_RECOJO'",
      orderBy: 'pk.fecha_listo ASC, p.id_pedido ASC'
    });
  }

  /** RF24 / RF25 / RF26: registra el cobro de un pedido LISTO_PARA_RECOJO. */
  async pagar(idCajero: number, codigo: string, dto: PagoDto) {
    const metodo = normalizarMetodo(dto?.metodoPago);

    await expirarVencidos(true);

    await conTransaccion(async conexion => {
      const pedido = await repoPedido.bloquearPorCodigo(conexion, codigo);
      if (!pedido) throw noEncontrado('PEDIDO_NO_ENCONTRADO', 'No se encontró el pedido.');

      // RF26: se revalida el estado dentro del bloqueo (evita doble cobro).
      const mensajes: Record<string, [string, string]> = {
        VIGENTE: ['PEDIDO_EN_PREPARACION', 'El pedido aún está en preparación en almacén.'],
        PAGADO: ['PEDIDO_YA_PAGADO', 'Este pedido ya fue pagado.'],
        ENTREGADO: ['PEDIDO_YA_ENTREGADO', 'Este pedido ya fue entregado.'],
        CANCELADO: ['PEDIDO_CANCELADO', 'Este pedido fue cancelado por el cliente.'],
        EXPIRADO: ['PEDIDO_EXPIRADO', 'Este ticket venció (superó las 48 horas) y ya no puede cobrarse.']
      };

      if (pedido.estado !== 'LISTO_PARA_RECOJO') {
        const [codigoError, mensaje] = mensajes[pedido.estado] ?? [
          'PEDIDO_NO_COBRABLE',
          'Este pedido no puede cobrarse en su estado actual.'
        ];
        throw conflicto(codigoError, mensaje);
      }

      const total = Number(pedido.total);
      let recibido = total;
      let vuelto = 0;
      let operacion: string | null = null;

      if (metodo === 'EFECTIVO') {
        recibido = redondear2(Number(dto?.montoRecibido));

        if (!Number.isFinite(recibido) || recibido < total) {
          throw badRequest('EFECTIVO_INSUFICIENTE', 'El efectivo recibido es insuficiente.');
        }
        vuelto = redondear2(recibido - total);
      } else {
        operacion = texto(dto?.numOperacion).slice(0, 50) || null;
      }

      const serie = pedido.tipo_comprobante === 'FACTURA' ? 'F001' : 'B001';
      const numero = await repoPago.siguienteNumero(conexion, serie);

      await repoPago.registrar(conexion, {
        id_pedido: pedido.id_pedido,
        id_cajero: idCajero,
        metodo_pago: metodo,
        monto_total: total,
        monto_recibido: recibido,
        vuelto_entregado: vuelto,
        numero_operacion: operacion,
        serie_comprobante: serie,
        numero_comprobante: numero
      });

      await repoPedido.cambiarEstado(conexion, pedido.id_pedido, 'PAGADO');
    });

    return (await repoPedido.ticketPorCodigo(codigo))!;
  }

  /** Ventas = pedidos con pago registrado, filtradas por fecha de pago. */
  async ventas(desde?: string, hasta?: string) {
    const d = inicioDelDia(desde);
    const h = finDelDia(hasta);

    const where = ['pg.fecha_pago IS NOT NULL'];
    const params: unknown[] = [];

    if (d) {
      where.push('pg.fecha_pago >= ?');
      params.push(d);
    }
    if (h) {
      where.push('pg.fecha_pago <= ?');
      params.push(h);
    }

    const ventas = await repoPedido.tickets({
      where: where.join(' AND '),
      params,
      orderBy: 'pg.fecha_pago DESC'
    });

    return {
      cantidad: ventas.length,
      total: redondear2(ventas.reduce((a, t) => a + t.total, 0)),
      ventas
    };
  }

  async detalleVenta(codigo: string) {
    const ticket = await repoPedido.ticketPorCodigo(codigo);
    if (!ticket || !ticket.fechaPago) {
      throw noEncontrado('VENTA_NO_ENCONTRADA', 'No existe una venta registrada con ese ticket.');
    }
    return ticket;
  }
}

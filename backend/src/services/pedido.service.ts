import { conTransaccion, PG_VALOR_DUPLICADO } from '../config/database';
import { CheckoutDto } from '../models/pedido.model';
import { CarritoRepository } from '../repositories/carrito.repository';
import { PedidoRepository } from '../repositories/pedido.repository';
import { ProductoRepository } from '../repositories/producto.repository';
import { TiendaRepository } from '../repositories/tienda.repository';
import { badRequest, conflicto, noEncontrado, prohibido } from '../utils/errores';
import { redondear2 } from '../utils/fechas';
import {
  normalizarTipoDocumento,
  pick,
  REGEX,
  texto,
  validarEmail,
  validarNumeroDocumento,
  validarTelefono9
} from '../utils/validadores';
import { expirarVencidos } from './expiracion.service';
import { InventarioService } from './inventario.service';

const IGV = 1.18; // los precios del catálogo ya incluyen IGV
const HORAS_VIGENCIA = 48; // RF11
const HORAS_MAX_CANCELACION = 24;

const repo = new PedidoRepository();
const repoCarrito = new CarritoRepository();
const repoProd = new ProductoRepository();
const repoTienda = new TiendaRepository();
const inventario = new InventarioService();

export class PedidoService {
  /* ------------------------------------------------------------------
   * Checkout: crea el pedido (ticket) y reserva el stock
   * ------------------------------------------------------------------ */
  async crear(idUsuario: number, dto: CheckoutDto) {
    // ---- 1. Validar datos de facturación (mismas reglas que checkout.ts) ----
    const tipoComprobante = texto(dto?.tipoComprobante).toLowerCase();
    if (tipoComprobante !== 'boleta' && tipoComprobante !== 'factura') {
      throw badRequest('COMPROBANTE_INVALIDO', 'tipoComprobante debe ser "boleta" o "factura".');
    }

    const nombre = texto(pick(dto, 'nombreFacturacion', 'cliente'));
    if (nombre.length < 3) {
      throw badRequest(
        'NOMBRE_FACTURACION_INVALIDO',
        tipoComprobante === 'boleta'
          ? 'Ingresa nombres y apellidos completos.'
          : 'Ingresa la razón social.'
      );
    }

    const tipoDoc = normalizarTipoDocumento(dto?.documentoTipo);

    if (tipoComprobante === 'factura' && tipoDoc !== 'RUC') {
      throw badRequest('DOCUMENTO_INVALIDO', 'La factura requiere RUC.');
    }
    if (tipoComprobante === 'boleta' && tipoDoc === 'RUC') {
      throw badRequest('DOCUMENTO_INVALIDO', 'La boleta se emite con DNI o CE / Pasaporte.');
    }

    const numeroDoc = validarNumeroDocumento(tipoDoc, dto?.documentoNumero);
    const correo = validarEmail(dto?.correo);
    const telefono = validarTelefono9(dto?.telefono);

    // ---- 2. Líneas del pedido: del body o del carrito guardado en la BD ----
    const desdeBody = Array.isArray(dto?.items) && dto.items.length > 0;
    const pedidas = new Map<string, number>();
    let idCarrito: number | null = null;

    if (desdeBody) {
      for (const it of dto.items!) {
        const sku = texto(pick(it, 'id', 'sku'));
        const cantidad = Number(pick(it, 'cantidad', 'qty') ?? 1);

        if (!sku || !Number.isInteger(cantidad) || cantidad <= 0) {
          throw badRequest('ITEM_INVALIDO', 'Cada producto necesita id y una cantidad entera > 0.');
        }
        pedidas.set(sku, (pedidas.get(sku) ?? 0) + cantidad);
      }
    } else {
      idCarrito = await repoCarrito.carritoActivoId(idUsuario);
      const filas = idCarrito ? await repoCarrito.items(idCarrito) : [];
      filas.forEach(f => pedidas.set(f.codigo_sku, Number(f.cantidad)));
    }

    if (pedidas.size === 0) {
      throw badRequest('CARRITO_VACIO', 'Tu carrito está vacío.');
    }

    // ---- 3. Transacción: validar stock, crear pedido, descontar stock ----
    let codigo = '';

    for (let intento = 0; intento < 5; intento++) {
      try {
        codigo = await conTransaccion(async conexion => {
          const tienda = await repoTienda.activaPorId(conexion, dto?.idTienda);
          if (!tienda) throw conflicto('TIENDA_NO_DISPONIBLE', 'No hay una tienda de recojo disponible.');

          const productos = await repoProd.bloquearPorSkus(conexion, [...pedidas.keys()]);
          const porSku = new Map(productos.map(p => [p.codigo_sku, p]));

          const lineas = [];
          let total = 0;

          for (const [sku, cantidad] of pedidas) {
            const p = porSku.get(sku);

            if (!p || p.estado === 'DESCONTINUADO') {
              throw noEncontrado('PRODUCTO_NO_ENCONTRADO', `El producto ${sku} ya no existe.`);
            }
            if (p.estado !== 'DISPONIBLE') {
              throw conflicto('PRODUCTO_NO_DISPONIBLE', `${p.nombre_completo} no está disponible.`);
            }

            const stock = Number(p.stock_tienda) + Number(p.stock_almacen);
            if (cantidad > stock) {
              throw conflicto(
                'STOCK_INSUFICIENTE',
                `Solo hay ${stock} unidad(es) de ${p.nombre_completo}.`
              );
            }

            const subtotalLinea = redondear2(Number(p.precio) * cantidad);
            total += subtotalLinea;
            lineas.push({ producto: p, cantidad, precio: Number(p.precio), subtotal: subtotalLinea });
          }

          total = redondear2(total);
          const subtotal = redondear2(total / IGV);
          const igv = redondear2(total - subtotal);

          const codigoTicket = await repo.siguienteCodigo(conexion);

          const idPedido = await repo.crear(
            conexion,
            {
              codigo_ticket: codigoTicket,
              id_usuario: idUsuario,
              id_tienda_recojo: tienda.id_tienda,
              tipo_comprobante: tipoComprobante === 'factura' ? 'FACTURA' : 'BOLETA',
              razon_social_nombre: nombre,
              tipo_documento_comprobante: tipoDoc,
              numero_documento_comprobante: numeroDoc,
              email_contacto: correo,
              telefono_contacto: telefono,
              subtotal,
              igv,
              total,
              fecha_expiracion: new Date(Date.now() + HORAS_VIGENCIA * 3600 * 1000)
            },
            lineas.map(l => ({
              id_producto: l.producto.id_producto,
              cantidad: l.cantidad,
              precio_unitario: l.precio,
              subtotal: l.subtotal
            }))
          );

          for (const l of lineas) {
            await inventario.descontarParaPedido(
              conexion,
              l.producto,
              l.cantidad,
              idUsuario,
              idPedido,
              codigoTicket
            );
          }

          if (idCarrito) await repoCarrito.marcarConvertido(conexion, idCarrito, idPedido);

          return codigoTicket;
        });
        break;
      } catch (error: any) {
        // Dos pedidos simultáneos pueden generar el mismo correlativo: se reintenta.
        if (error?.code === PG_VALOR_DUPLICADO && intento < 4) continue;
        throw error;
      }
    }

    return (await repo.ticketPorCodigo(codigo))!;
  }

  /* ------------------------------------------------------------------
   * Consultas del cliente
   * ------------------------------------------------------------------ */
  async misPedidos(idUsuario: number) {
    await expirarVencidos();
    return repo.tickets({ where: 'p.id_usuario = ?', params: [idUsuario] });
  }

  /** CLIENTE: solo sus pedidos. Personal: cualquiera. */
  async obtener(codigo: string, auth: { id: number; rol: string }) {
    await expirarVencidos();

    const ticket = await repo.ticketPorCodigo(codigo);
    if (!ticket) throw noEncontrado('PEDIDO_NO_ENCONTRADO', 'No se encontró el pedido.');

    if (auth.rol === 'CLIENTE') {
      const [propio] = await repo.tickets({
        where: 'p.codigo_ticket = ? AND p.id_usuario = ?',
        params: [codigo, auth.id],
        limit: 1
      });
      // Mismo mensaje que "no existe" para no revelar pedidos ajenos.
      if (!propio) throw noEncontrado('PEDIDO_NO_ENCONTRADO', 'No se encontró el pedido.');
    }

    return ticket;
  }

  /* ------------------------------------------------------------------
   * Cancelar (solo cliente, VIGENTE y dentro de las primeras 24 h)
   * ------------------------------------------------------------------ */
  async cancelar(idUsuario: number, codigo: string) {
    await expirarVencidos(true);

    await conTransaccion(async conexion => {
      const pedido = await repo.bloquearPorCodigo(conexion, codigo);

      if (!pedido || pedido.id_usuario !== idUsuario) {
        throw noEncontrado('PEDIDO_NO_ENCONTRADO', 'No se encontró el pedido.');
      }
      if (pedido.estado !== 'VIGENTE') {
        throw conflicto(
          'PEDIDO_NO_CANCELABLE',
          'Solo se pueden cancelar los pedidos que aún están VIGENTES.'
        );
      }

      const horas = (Date.now() - new Date(pedido.fecha_emision).getTime()) / 3_600_000;
      if (horas >= HORAS_MAX_CANCELACION) {
        throw conflicto(
          'CANCELACION_FUERA_DE_PLAZO',
          'Solo puedes cancelar durante las primeras 24 horas.'
        );
      }

      await inventario.restaurarPedido(
        conexion,
        pedido.id_pedido,
        idUsuario,
        `Devolución por cancelación del pedido ${pedido.codigo_ticket}`
      );
      await repo.cambiarEstado(conexion, pedido.id_pedido, 'CANCELADO', true);
    });

    return (await repo.ticketPorCodigo(codigo))!;
  }

  /* ------------------------------------------------------------------
   * Persona autorizada para el recojo (RF28 / RF33)
   * ------------------------------------------------------------------ */
  async fijarPersonaAutorizada(idUsuario: number, codigo: string, body: any) {
    const nombre = texto(body?.nombre);
    const dni = texto(body?.dni);

    if (nombre.length < 3) {
      throw badRequest('NOMBRE_INVALIDO', 'Ingresa nombres y apellidos completos.');
    }
    if (!REGEX.dni.test(dni)) {
      throw badRequest('DNI_INVALIDO', 'El DNI debe tener exactamente 8 dígitos.');
    }

    const pedido = await this.pedidoGestionable(idUsuario, codigo);
    await repo.fijarPersonaAutorizada(pedido.id, { nombre, dni });

    return (await repo.ticketPorCodigo(codigo))!;
  }

  async quitarPersonaAutorizada(idUsuario: number, codigo: string) {
    const pedido = await this.pedidoGestionable(idUsuario, codigo);
    await repo.fijarPersonaAutorizada(pedido.id, null);

    return (await repo.ticketPorCodigo(codigo))!;
  }

  private async pedidoGestionable(idUsuario: number, codigo: string) {
    await expirarVencidos(true);

    const [pedido] = await repo.tickets({
      where: 'p.codigo_ticket = ? AND p.id_usuario = ?',
      params: [codigo, idUsuario],
      limit: 1
    });

    if (!pedido) throw noEncontrado('PEDIDO_NO_ENCONTRADO', 'No se encontró el pedido.');

    if (['ENTREGADO', 'CANCELADO', 'EXPIRADO'].includes(pedido.estado)) {
      throw prohibido(
        'PEDIDO_FINALIZADO',
        'Este pedido ya no admite cambios de persona autorizada.'
      );
    }

    const id = await repo.idPorCodigo(codigo);
    if (!id) throw noEncontrado('PEDIDO_NO_ENCONTRADO', 'No se encontró el pedido.');

    return { id };
  }
}

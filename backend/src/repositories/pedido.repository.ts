import { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

import { pool } from '../config/database';
import { EstadoPedido, Ticket, TicketItem } from '../models/pedido.model';
import { aIso } from '../utils/fechas';

/* ------------------------------------------------------------------ */
/* Tipos de filas                                                      */
/* ------------------------------------------------------------------ */

export interface PedidoBaseRow extends RowDataPacket {
  id_pedido: number;
  id_usuario: number;
  id_tienda_recojo: number;
  codigo_ticket: string;
  tipo_comprobante: 'BOLETA' | 'FACTURA';
  razon_social_nombre: string;
  tipo_documento_comprobante: string;
  numero_documento_comprobante: string;
  email_contacto: string;
  telefono_contacto: string;
  subtotal: number;
  igv: number;
  total: number;
  estado: EstadoPedido;
  fecha_emision: Date;
  fecha_expiracion: Date;
  fecha_cancelacion: Date | null;
  persona_autorizada_recojo: string | null;
  dni_autorizado_recojo: string | null;
}

interface TicketRow extends PedidoBaseRow {
  nombres: string;
  apellidos: string;
  nombre_tienda: string;
  direccion_tienda: string;
  horario_atencion: string | null;
  metodo_pago: string | null;
  monto_recibido: number | null;
  vuelto_entregado: number | null;
  numero_operacion: string | null;
  serie_comprobante: string | null;
  numero_comprobante: string | null;
  fecha_pago: Date | null;
  fecha_listo: Date | null;
  fecha_entrega: Date | null;
}

interface DetalleRow extends RowDataPacket {
  id_pedido: number;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  codigo_sku: string;
  nombre_completo: string;
  medida: string | null;
  cantidad_caja: number | null;
  cantidad_bolsa: number | null;
  imagen_url: string | null;
  nombre_categoria: string;
  subcategoria: string | null;
}

export interface FiltroTickets {
  where?: string;
  params?: unknown[];
  orderBy?: string;
  limit?: number;
}

/* ------------------------------------------------------------------ */
/* Conversión BD -> forma que espera el frontend                       */
/* ------------------------------------------------------------------ */

function etiquetaMetodo(metodo: string | null): string | undefined {
  if (!metodo) return undefined;
  if (metodo === 'EFECTIVO') return 'Efectivo';
  if (metodo.startsWith('TARJETA')) return 'Tarjeta';
  if (metodo === 'YAPE' || metodo === 'PLIN') return 'Yape/Plin';
  if (metodo === 'TRANSFERENCIA') return 'Transferencia';
  return metodo;
}

function etiquetaDocumento(tipo: string): string {
  return tipo === 'CE' ? 'CE/Pasaporte' : tipo;
}

function aTicket(fila: TicketRow, items: TicketItem[]): Ticket {
  const personaAutorizada =
    fila.persona_autorizada_recojo && fila.dni_autorizado_recojo
      ? { nombre: fila.persona_autorizada_recojo, dni: fila.dni_autorizado_recojo }
      : null;

  const ticket: Ticket = {
    id: fila.codigo_ticket,
    fechaEmision: aIso(fila.fecha_emision),
    fechaExpiracion: aIso(fila.fecha_expiracion),
    cliente: `${fila.nombres} ${fila.apellidos}`.trim(),
    nombreFacturacion: fila.razon_social_nombre,
    documentoTipo: etiquetaDocumento(fila.tipo_documento_comprobante),
    documentoNumero: fila.numero_documento_comprobante,
    correo: fila.email_contacto,
    telefono: fila.telefono_contacto,
    tipoComprobante: fila.tipo_comprobante === 'FACTURA' ? 'factura' : 'boleta',
    productos: items,
    subtotal: Number(fila.subtotal),
    igv: Number(fila.igv),
    total: Number(fila.total),
    estado: fila.estado,
    personaAutorizada,
    tienda: {
      id: fila.id_tienda_recojo,
      nombre: fila.nombre_tienda,
      direccion: fila.direccion_tienda,
      horario: fila.horario_atencion
    }
  };

  if (fila.fecha_pago) {
    ticket.metodoPago = etiquetaMetodo(fila.metodo_pago);
    ticket.montoRecibido = Number(fila.monto_recibido ?? 0);
    ticket.vueltoEntregado = Number(fila.vuelto_entregado ?? 0);
    ticket.numOperacion = fila.numero_operacion ?? '';
    ticket.comprobante = `${fila.serie_comprobante}-${fila.numero_comprobante}`;
    ticket.fechaPago = aIso(fila.fecha_pago)!;
  }
  if (fila.fecha_listo) ticket.fechaListoParaRecojo = aIso(fila.fecha_listo)!;
  if (fila.fecha_entrega) ticket.fechaEntrega = aIso(fila.fecha_entrega)!;
  if (fila.estado === 'EXPIRADO') ticket.fechaExpirado = aIso(fila.fecha_expiracion)!;
  if (fila.fecha_cancelacion) ticket.fechaCancelacion = aIso(fila.fecha_cancelacion)!;

  return ticket;
}

const SELECT_TICKET = `
  SELECT p.id_pedido, p.id_usuario, p.id_tienda_recojo, p.codigo_ticket,
         p.tipo_comprobante, p.razon_social_nombre, p.tipo_documento_comprobante,
         p.numero_documento_comprobante, p.email_contacto, p.telefono_contacto,
         p.subtotal, p.igv, p.total, p.estado, p.fecha_emision, p.fecha_expiracion,
         p.fecha_cancelacion, p.persona_autorizada_recojo, p.dni_autorizado_recojo,
         u.nombres, u.apellidos,
         t.nombre_tienda, t.direccion AS direccion_tienda, t.horario_atencion,
         pg.metodo_pago, pg.monto_recibido, pg.vuelto_entregado, pg.numero_operacion,
         pg.serie_comprobante, pg.numero_comprobante, pg.fecha_pago,
         pk.fecha_listo, pk.fecha_entrega
    FROM tbl_pedidos p
    JOIN tbl_usuarios u ON u.id_usuario = p.id_usuario
    JOIN tbl_tiendas_recojo t ON t.id_tienda = p.id_tienda_recojo
    LEFT JOIN tbl_pagos pg ON pg.id_pedido = p.id_pedido AND pg.estado = 'COMPLETADO'
    LEFT JOIN tbl_picking_almacen pk ON pk.id_pedido = p.id_pedido
`;

export interface LineaPedidoNueva {
  id_producto: number;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
}

export class PedidoRepository {
  /* ---------------------------- lectura --------------------------- */

  /**
   * Devuelve tickets completos (con productos). Los fragmentos SQL de `where`
   * y `orderBy` los arma siempre el código del servidor; los valores van en `params`.
   */
  async tickets(filtro: FiltroTickets = {}): Promise<Ticket[]> {
    const [filas] = await pool.query<TicketRow[]>(
      `${SELECT_TICKET}
       ${filtro.where ? 'WHERE ' + filtro.where : ''}
       ORDER BY ${filtro.orderBy ?? 'p.fecha_emision DESC, p.id_pedido DESC'}
       ${filtro.limit ? 'LIMIT ' + Number(filtro.limit) : ''}`,
      filtro.params ?? []
    );

    if (filas.length === 0) return [];

    const ids = filas.map(f => f.id_pedido);

    const [detalles] = await pool.query<DetalleRow[]>(
      `SELECT d.id_pedido, d.cantidad, d.precio_unitario, d.subtotal,
              pr.codigo_sku, pr.nombre_completo, pr.medida,
              pr.cantidad_caja, pr.cantidad_bolsa, pr.imagen_url,
              c.nombre_categoria, pr.subcategoria
         FROM tbl_detalle_pedidos d
         JOIN tbl_productos pr ON pr.id_producto = d.id_producto
         JOIN tbl_categorias c ON c.id_categoria = pr.id_categoria
        WHERE d.id_pedido IN (?)
        ORDER BY d.id_detalle ASC`,
      [ids]
    );

    const porPedido = new Map<number, TicketItem[]>();

    for (const d of detalles) {
      const lista = porPedido.get(d.id_pedido) ?? [];
      lista.push({
        id: d.codigo_sku,
        nombre: d.nombre_completo,
        precio: Number(d.precio_unitario),
        cantidad: Number(d.cantidad),
        subtotal: Number(d.subtotal),
        medida: d.medida,
        cantidadCaja: d.cantidad_caja || null,
        cantidadBolsa: d.cantidad_bolsa || null,
        categoria: d.nombre_categoria,
        subcategoria: d.subcategoria,
        imagen: d.imagen_url
      });
      porPedido.set(d.id_pedido, lista);
    }

    return filas.map(f => aTicket(f, porPedido.get(f.id_pedido) ?? []));
  }

  async ticketPorCodigo(codigo: string): Promise<Ticket | null> {
    const lista = await this.tickets({ where: 'p.codigo_ticket = ?', params: [codigo], limit: 1 });
    return lista[0] ?? null;
  }

  async idPorCodigo(codigo: string): Promise<number | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT id_pedido FROM tbl_pedidos WHERE codigo_ticket = ? LIMIT 1',
      [codigo]
    );
    return rows[0] ? Number(rows[0].id_pedido) : null;
  }

  async contarPorEstado(): Promise<Record<string, number>> {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT estado, COUNT(*) AS n FROM tbl_pedidos GROUP BY estado'
    );
    const resultado: Record<string, number> = {};
    rows.forEach(r => (resultado[r.estado as string] = Number(r.n)));
    return resultado;
  }

  /* -------------------------- bloqueos / escritura ---------------- */

  async bloquearPorCodigo(conexion: PoolConnection, codigo: string): Promise<PedidoBaseRow | null> {
    const [rows] = await conexion.query<PedidoBaseRow[]>(
      'SELECT * FROM tbl_pedidos WHERE codigo_ticket = ? LIMIT 1 FOR UPDATE',
      [codigo]
    );
    return rows[0] ?? null;
  }

  async idsVencidos(): Promise<number[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id_pedido FROM tbl_pedidos
        WHERE estado IN ('VIGENTE', 'LISTO_PARA_RECOJO', 'EN_PREPARACION')
          AND fecha_expiracion < UTC_TIMESTAMP()`
    );
    return rows.map(r => Number(r.id_pedido));
  }

  async bloquearPorId(conexion: PoolConnection, id: number): Promise<PedidoBaseRow | null> {
    const [rows] = await conexion.query<PedidoBaseRow[]>(
      'SELECT * FROM tbl_pedidos WHERE id_pedido = ? LIMIT 1 FOR UPDATE',
      [id]
    );
    return rows[0] ?? null;
  }

  /** TK-2026-00001, TK-2026-00002, ... (correlativo por año). */
  async siguienteCodigo(conexion: PoolConnection): Promise<string> {
    const anio = new Date().getUTCFullYear();
    const prefijo = `TK-${anio}-`;

    const [rows] = await conexion.query<RowDataPacket[]>(
      `SELECT COALESCE(MAX(CAST(SUBSTRING(codigo_ticket, ?) AS UNSIGNED)), 0) AS ultimo
         FROM tbl_pedidos
        WHERE codigo_ticket LIKE ?`,
      [prefijo.length + 1, `${prefijo}%`]
    );

    const siguiente = Number(rows[0].ultimo) + 1;
    return `${prefijo}${String(siguiente).padStart(5, '0')}`;
  }

  async crear(
    conexion: PoolConnection,
    datos: {
      codigo_ticket: string;
      id_usuario: number;
      id_tienda_recojo: number;
      tipo_comprobante: 'BOLETA' | 'FACTURA';
      razon_social_nombre: string;
      tipo_documento_comprobante: string;
      numero_documento_comprobante: string;
      email_contacto: string;
      telefono_contacto: string;
      subtotal: number;
      igv: number;
      total: number;
      fecha_expiracion: Date;
    },
    lineas: LineaPedidoNueva[]
  ): Promise<number> {
    const [res] = await conexion.execute<ResultSetHeader>(
      `INSERT INTO tbl_pedidos
         (codigo_ticket, id_usuario, id_tienda_recojo, tipo_comprobante,
          razon_social_nombre, tipo_documento_comprobante, numero_documento_comprobante,
          email_contacto, telefono_contacto, subtotal, igv, total, estado, fecha_expiracion)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'VIGENTE', ?)`,
      [
        datos.codigo_ticket,
        datos.id_usuario,
        datos.id_tienda_recojo,
        datos.tipo_comprobante,
        datos.razon_social_nombre,
        datos.tipo_documento_comprobante,
        datos.numero_documento_comprobante,
        datos.email_contacto,
        datos.telefono_contacto,
        datos.subtotal,
        datos.igv,
        datos.total,
        datos.fecha_expiracion
      ]
    );

    const idPedido = res.insertId;

    for (const l of lineas) {
      await conexion.execute(
        `INSERT INTO tbl_detalle_pedidos (id_pedido, id_producto, cantidad, precio_unitario, subtotal)
         VALUES (?, ?, ?, ?, ?)`,
        [idPedido, l.id_producto, l.cantidad, l.precio_unitario, l.subtotal]
      );
    }

    await conexion.execute(
      `INSERT INTO tbl_picking_almacen (id_pedido, estado_picking, total_items, items_separados)
       VALUES (?, 'PENDIENTE', ?, 0)`,
      [idPedido, lineas.length]
    );

    return idPedido;
  }

  async cambiarEstado(
    conexion: PoolConnection,
    idPedido: number,
    estado: EstadoPedido,
    cancelado = false
  ): Promise<void> {
    await conexion.execute(
      `UPDATE tbl_pedidos
          SET estado = ?${cancelado ? ', fecha_cancelacion = UTC_TIMESTAMP()' : ''}
        WHERE id_pedido = ?`,
      [estado, idPedido]
    );
  }

  async fijarPersonaAutorizada(
    idPedido: number,
    persona: { nombre: string; dni: string } | null
  ): Promise<void> {
    await pool.execute(
      `UPDATE tbl_pedidos
          SET persona_autorizada_recojo = ?, dni_autorizado_recojo = ?
        WHERE id_pedido = ?`,
      [persona?.nombre ?? null, persona?.dni ?? null, idPedido]
    );
  }

  async lineas(
    conexion: PoolConnection,
    idPedido: number
  ): Promise<Array<{ id_producto: number; cantidad: number }>> {
    const [rows] = await conexion.query<RowDataPacket[]>(
      'SELECT id_producto, cantidad FROM tbl_detalle_pedidos WHERE id_pedido = ?',
      [idPedido]
    );
    return rows.map(r => ({ id_producto: Number(r.id_producto), cantidad: Number(r.cantidad) }));
  }
}

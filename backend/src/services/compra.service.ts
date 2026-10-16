import { conTransaccion } from '../config/database';
import { CompraRepository, CompraRow } from '../repositories/compra.repository';
import { InventarioRepository, Ubicacion } from '../repositories/inventario.repository';
import { ProductoRepository } from '../repositories/producto.repository';
import { badRequest, conflicto, noEncontrado } from '../utils/errores';
import { aIso, finDelDia, inicioDelDia, redondear2 } from '../utils/fechas';
import { REGEX, texto } from '../utils/validadores';

const repo = new CompraRepository();
const repoProd = new ProductoRepository();
const repoInv = new InventarioRepository();

function aDto(c: CompraRow) {
  return {
    id: c.codigo_compra,
    proveedor: c.proveedor_nombre,
    ruc: c.proveedor_ruc,
    tipoComprobante: c.tipo_comprobante,
    numeroComprobante: c.numero_comprobante,
    ubicacion: c.ubicacion_destino,
    subtotal: Number(c.subtotal),
    igv: Number(c.igv),
    total: Number(c.total),
    estado: c.estado,
    observaciones: c.observaciones,
    fecha: aIso(c.fecha_compra),
    fechaAnulacion: aIso(c.fecha_anulacion),
    usuario: c.usuario,
    items: Number(c.items),
    unidades: Number(c.unidades)
  };
}

export class CompraService {
  async listar(q: { desde?: string; hasta?: string; estado?: string; q?: string }) {
    const where: string[] = [];
    const params: unknown[] = [];
    const d = inicioDelDia(q.desde);
    const h = finDelDia(q.hasta);

    if (d) { where.push('c.fecha_compra >= ?'); params.push(d); }
    if (h) { where.push('c.fecha_compra <= ?'); params.push(h); }
    if (q.estado === 'REGISTRADA' || q.estado === 'ANULADA') { where.push('c.estado = ?'); params.push(q.estado); }
    if (q.q) {
      where.push('(c.codigo_compra LIKE ? OR c.proveedor_nombre LIKE ? OR c.proveedor_ruc LIKE ? OR c.numero_comprobante LIKE ?)');
      const like = `%${q.q}%`;
      params.push(like, like, like, like);
    }

    const compras = (await repo.listar({ where, params })).map(aDto);
    const validas = compras.filter(c => c.estado === 'REGISTRADA');

    return {
      cantidad: validas.length,
      total: redondear2(validas.reduce((a, c) => a + c.total, 0)),
      compras
    };
  }

  async detalle(codigo: string) {
    const compra = await repo.porCodigo(codigo);
    if (!compra) throw noEncontrado('COMPRA_NO_ENCONTRADA', 'La compra no existe.');

    const items = await repo.detalle(compra.id_compra);
    return {
      ...aDto(compra),
      productos: items.map(i => ({
        id: i.codigo_sku,
        nombre: i.nombre_completo,
        cantidad: Number(i.cantidad),
        costoUnitario: Number(i.costo_unitario),
        subtotal: Number(i.subtotal)
      }))
    };
  }

  /** Registra la compra y SUMA el stock (movimiento ENTRADA en el kardex). */
  async crear(idUsuario: number, body: any) {
    const proveedor = texto(body?.proveedor ?? body?.proveedorNombre);
    const ruc = texto(body?.ruc ?? body?.proveedorRuc);
    const tipo = texto(body?.tipoComprobante).toUpperCase() || 'FACTURA';
    const numero = texto(body?.numeroComprobante) || null;
    const observaciones = texto(body?.observaciones).slice(0, 255) || null;
    const ubicacion = (texto(body?.ubicacion).toUpperCase() || 'ALMACEN') as Ubicacion;

    if (proveedor.length < 3) throw badRequest('PROVEEDOR_INVALIDO', 'Ingresa el nombre o razón social del proveedor.');
    if (ruc && !REGEX.ruc.test(ruc)) throw badRequest('RUC_INVALIDO', 'El RUC debe tener 11 dígitos y empezar con 10, 15, 17 o 20.');
    if (!['FACTURA', 'BOLETA', 'GUIA', 'OTRO'].includes(tipo)) throw badRequest('COMPROBANTE_INVALIDO', 'Tipo de comprobante no válido.');
    if (ubicacion !== 'ALMACEN' && ubicacion !== 'TIENDA') throw badRequest('UBICACION_INVALIDA', 'Destino: ALMACEN o TIENDA.');

    const items: any[] = Array.isArray(body?.items) ? body.items : [];
    if (items.length === 0) throw badRequest('SIN_PRODUCTOS', 'Agrega al menos un producto a la compra.');

    const acumulado = new Map<string, { cantidad: number; costo: number }>();
    for (const it of items) {
      const sku = texto(it?.id ?? it?.sku);
      const cantidad = Number(it?.cantidad);
      const costo = Number(it?.costoUnitario ?? it?.costo);

      if (!sku || !Number.isInteger(cantidad) || cantidad <= 0) {
        throw badRequest('ITEM_INVALIDO', 'Cada producto necesita SKU y una cantidad entera mayor a 0.');
      }
      if (!Number.isFinite(costo) || costo < 0) {
        throw badRequest('COSTO_INVALIDO', 'El costo unitario debe ser un número mayor o igual a 0.');
      }
      const previo = acumulado.get(sku);
      acumulado.set(sku, { cantidad: (previo?.cantidad ?? 0) + cantidad, costo });
    }

    let codigo = '';

    for (let intento = 0; intento < 5; intento++) {
      try {
        codigo = await conTransaccion(async conexion => {
          const productos = await repoProd.bloquearPorSkus(conexion, [...acumulado.keys()]);
          const porSku = new Map(productos.map(p => [p.codigo_sku, p]));

          const lineas = [];
          let subtotal = 0;

          for (const [sku, v] of acumulado) {
            const p = porSku.get(sku);
            if (!p) throw noEncontrado('PRODUCTO_NO_ENCONTRADO', `El producto ${sku} no existe.`);
            const sub = redondear2(v.cantidad * v.costo);
            subtotal += sub;
            lineas.push({ p, cantidad: v.cantidad, costo: v.costo, subtotal: sub });
          }

          subtotal = redondear2(subtotal);
          const igv = redondear2(subtotal * 0.18);
          const total = redondear2(subtotal + igv);

          const cod = await repo.siguienteCodigo(conexion);
          const idCompra = await repo.crear(
            conexion,
            { codigo: cod, idUsuario, proveedorNombre: proveedor, proveedorRuc: ruc || null, tipoComprobante: tipo, numeroComprobante: numero, ubicacion, subtotal, igv, total, observaciones },
            lineas.map(l => ({ id_producto: l.p.id_producto, cantidad: l.cantidad, costo: l.costo, subtotal: l.subtotal }))
          );
          void idCompra;

          for (const l of lineas) {
            let tienda = Number(l.p.stock_tienda);
            let almacen = Number(l.p.stock_almacen);
            const antes = ubicacion === 'TIENDA' ? tienda : almacen;
            if (ubicacion === 'TIENDA') tienda += l.cantidad; else almacen += l.cantidad;

            await repoInv.registrarMovimiento(conexion, {
              id_producto: l.p.id_producto,
              id_usuario: idUsuario,
              tipo_movimiento: 'ENTRADA',
              ubicacion_destino: ubicacion,
              cantidad: l.cantidad,
              stock_anterior: antes,
              stock_posterior: antes + l.cantidad,
              motivo: `Compra ${cod} · ${proveedor}`.slice(0, 255)
            });
            await repoProd.actualizarStock(conexion, l.p.id_producto, tienda, almacen);
          }
          return cod;
        });
        break;
      } catch (error: any) {
        if (error?.code === 'ER_DUP_ENTRY' && intento < 4) continue;
        throw error;
      }
    }

    return this.detalle(codigo);
  }

  /** Anula la compra y RESTA el stock que había ingresado (si todavía hay suficiente). */
  async anular(idUsuario: number, codigo: string) {
    await conTransaccion(async conexion => {
      const compra = await repo.bloquearPorCodigo(conexion, codigo);
      if (!compra) throw noEncontrado('COMPRA_NO_ENCONTRADA', 'La compra no existe.');
      if (compra.estado === 'ANULADA') throw conflicto('COMPRA_YA_ANULADA', 'La compra ya está anulada.');

      const items = await repo.detalle(compra.id_compra, conexion);
      const productos = await repoProd.bloquearPorIds(conexion, items.map(i => i.id_producto));
      const porId = new Map(productos.map(p => [p.id_producto, p]));
      const ubicacion = compra.ubicacion_destino;

      for (const i of items) {
        const p = porId.get(i.id_producto)!;
        const actual = ubicacion === 'TIENDA' ? Number(p.stock_tienda) : Number(p.stock_almacen);
        if (actual < i.cantidad) {
          throw conflicto(
            'STOCK_INSUFICIENTE_PARA_ANULAR',
            `No se puede anular: de ${p.nombre_completo} ya se usaron unidades (hay ${actual} y la compra ingresó ${i.cantidad}).`
          );
        }
      }

      for (const i of items) {
        const p = porId.get(i.id_producto)!;
        let tienda = Number(p.stock_tienda);
        let almacen = Number(p.stock_almacen);
        const antes = ubicacion === 'TIENDA' ? tienda : almacen;
        if (ubicacion === 'TIENDA') tienda -= i.cantidad; else almacen -= i.cantidad;

        await repoInv.registrarMovimiento(conexion, {
          id_producto: i.id_producto,
          id_usuario: idUsuario,
          tipo_movimiento: 'SALIDA',
          ubicacion_origen: ubicacion,
          cantidad: i.cantidad,
          stock_anterior: antes,
          stock_posterior: antes - i.cantidad,
          motivo: `Anulación de compra ${compra.codigo_compra}`
        });
        await repoProd.actualizarStock(conexion, i.id_producto, tienda, almacen);
      }

      await repo.marcarAnulada(conexion, compra.id_compra);
    });

    return this.detalle(codigo);
  }
}

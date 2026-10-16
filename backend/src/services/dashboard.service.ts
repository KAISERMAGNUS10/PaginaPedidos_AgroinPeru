import { conTransaccion } from '../config/database';
import { Ticket } from '../models/pedido.model';
import { DashboardRepository } from '../repositories/dashboard.repository';
import { ReporteRepository } from '../repositories/reporte.repository';
import { PedidoRepository } from '../repositories/pedido.repository';
import { badRequest } from '../utils/errores';
import { fechaPeruMenosDias, finDelDia, inicioDelDia, redondear2 } from '../utils/fechas';
import { expirarVencidos } from './expiracion.service';

const repoPedido = new PedidoRepository();
const repoDash = new DashboardRepository();
const repoReporte = new ReporteRepository();

const suma = (lista: Ticket[]) => redondear2(lista.reduce((a, t) => a + t.total, 0));
const unidades = (t: Ticket) => t.productos.reduce((a, i) => a + i.cantidad, 0);

export class DashboardService {
  /**
   * Todo lo que pinta el dashboard del admin: KPIs, contadores por estado,
   * gráficos, actividad reciente y las tablas de ventas / entregas / clientes.
   * `desde` y `hasta` (YYYY-MM-DD) filtran ventas, entregas, pedidos y clientes;
   * los contadores por estado, el gráfico de 7 días y la actividad son globales.
   */
  async resumen(desde?: string, hasta?: string) {
    await expirarVencidos();

    const d = inicioDelDia(desde);
    const h = finDelDia(hasta);

    const rango = (campo: string) => {
      const where: string[] = [`${campo} IS NOT NULL`];
      const params: unknown[] = [];
      if (d) { where.push(`${campo} >= ?`); params.push(d); }
      if (h) { where.push(`${campo} <= ?`); params.push(h); }
      return { where: where.join(' AND '), params };
    };

    const rVentas = rango('pg.fecha_pago');
    const rEntregas = rango('pk.fecha_entrega');
    const rPedidos = rango('p.fecha_emision');

    const [ventas, entregas, pedidos, porEstado, recientes] = await Promise.all([
      repoPedido.tickets({ ...rVentas, orderBy: 'pg.fecha_pago DESC' }),
      repoPedido.tickets({
        where: `p.estado = 'ENTREGADO' AND ${rEntregas.where}`,
        params: rEntregas.params,
        orderBy: 'pk.fecha_entrega DESC'
      }),
      repoPedido.tickets({ ...rPedidos, orderBy: 'p.fecha_emision DESC' }),
      repoPedido.contarPorEstado(),
      repoPedido.tickets({ limit: 100 })
    ]);

    // Clientes agrupados (misma lógica que adminAgruparClientes del frontend)
    const mapa = new Map<
      string,
      { nombre: string; documento: string; correo: string; telefono: string; pedidos: Ticket[] }
    >();

    for (const t of pedidos) {
      const clave = t.documentoNumero || t.correo || t.nombreFacturacion || t.id;
      if (!mapa.has(clave)) {
        mapa.set(clave, {
          nombre: t.nombreFacturacion || t.cliente || 'Cliente',
          documento: t.documentoNumero || '—',
          correo: t.correo || '—',
          telefono: t.telefono || '—',
          pedidos: []
        });
      }
      mapa.get(clave)!.pedidos.push(t);
    }

    const clientes = [...mapa.values()]
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
      .map(c => ({ ...c, cantidadPedidos: c.pedidos.length, valorPedidos: suma(c.pedidos) }));

    const n = (e: string) => porEstado[e] ?? 0;

    return {
      kpis: {
        ventas: ventas.length,
        totalVendido: suma(ventas),
        entregados: entregas.length,
        pedidos: pedidos.length,
        clientes: clientes.length
      },
      estados: {
        vigente: n('VIGENTE'),
        listo: n('LISTO_PARA_RECOJO'),
        pagado: n('PAGADO'),
        entregado: n('ENTREGADO'),
        inactivos: n('CANCELADO') + n('EXPIRADO')
      },
      inventario: await repoReporte.inventario(),
      compras: await this.resumenCompras(d, h),
      ventasUltimos7Dias: await this.ventas7Dias(),
      actividad: this.actividad(recientes),
      ventas,
      entregas: entregas.map(t => ({ ...t, unidades: unidades(t) })),
      pedidos,
      clientes
    };
  }

  private async resumenCompras(d: Date | null, h: Date | null) {
    const desde = d ?? new Date(0);
    const hasta = h ?? new Date();
    const filas = await repoReporte.comprasPorDia([desde, hasta]);
    return {
      cantidad: filas.reduce((a, x) => a + x.cantidad, 0),
      total: redondear2(filas.reduce((a, x) => a + x.total, 0))
    };
  }

  private async ventas7Dias() {
    const inicioStr = fechaPeruMenosDias(6);
    const desde = inicioDelDia(inicioStr)!;
    const hasta = new Date();
    const filas = await repoDash.ventasPorDia(desde, hasta);
    const porDia = new Map(filas.map(f => [f.dia, f.total]));

    return Array.from({ length: 7 }, (_, i) => {
      const fecha = fechaPeruMenosDias(6 - i);
      return { fecha, total: redondear2(porDia.get(fecha) ?? 0) };
    });
  }

  private actividad(tickets: Ticket[]) {
    const eventos: Array<{ fecha: string; tipo: string; titulo: string; detalle: string }> = [];

    for (const t of tickets) {
      const cliente = t.nombreFacturacion || t.cliente || 'Cliente';
      if (t.fechaEmision) eventos.push({ fecha: t.fechaEmision, tipo: 'PEDIDO', titulo: 'Pedido generado', detalle: `${t.id} · ${cliente}` });
      if (t.fechaListoParaRecojo) eventos.push({ fecha: t.fechaListoParaRecojo, tipo: 'LISTO', titulo: 'Pedido listo para recojo', detalle: `${t.id} · Almacén finalizó preparación` });
      if (t.fechaPago) eventos.push({ fecha: t.fechaPago, tipo: 'PAGO', titulo: 'Pago registrado', detalle: `${t.id} · ${t.metodoPago ?? 'Método no indicado'} · S/ ${t.total.toFixed(2)}` });
      if (t.fechaEntrega) eventos.push({ fecha: t.fechaEntrega, tipo: 'ENTREGA', titulo: 'Pedido entregado', detalle: `${t.id} · ${cliente}` });
      if (t.fechaExpirado) eventos.push({ fecha: t.fechaExpirado, tipo: 'EXPIRADO', titulo: 'Pedido expirado', detalle: `${t.id} · Superó las 48 horas de vigencia` });
      if (t.fechaCancelacion) eventos.push({ fecha: t.fechaCancelacion, tipo: 'CANCELADO', titulo: 'Pedido cancelado', detalle: `${t.id} · ${cliente}` });
    }

    return eventos.sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 8);
  }

  /** Equivale al botón "Reiniciar demo" del dashboard. Conserva usuarios y catálogo. */
  async reiniciarDemo(confirmar: unknown) {
    if (confirmar !== true && confirmar !== 'true') {
      throw badRequest('CONFIRMACION_REQUERIDA', 'Envía { "confirmar": true } para reiniciar la demo.');
    }

    await conTransaccion(conexion => repoDash.reiniciarDatosOperativos(conexion));
    return { reiniciado: true };
  }
}

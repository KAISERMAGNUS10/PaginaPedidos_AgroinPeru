import { ReporteRepository } from '../repositories/reporte.repository';
import { fechaPeruMenosDias, finDelDia, inicioDelDia, redondear2 } from '../utils/fechas';
import { expirarVencidos } from './expiracion.service';

const repo = new ReporteRepository();

/** Rellena con ceros los días sin movimiento, para que el gráfico no tenga huecos. */
function completarDias<T extends { fecha: string }>(desde: string, hasta: string, filas: T[], vacio: Omit<T, 'fecha'>): T[] {
  const mapa = new Map(filas.map(f => [f.fecha, f]));
  const salida: T[] = [];
  const cursor = new Date(`${desde}T12:00:00Z`);
  const fin = new Date(`${hasta}T12:00:00Z`);
  let guardia = 0;

  while (cursor <= fin && guardia++ < 400) {
    const f = cursor.toISOString().slice(0, 10);
    salida.push(mapa.get(f) ?? ({ fecha: f, ...vacio } as T));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return salida;
}

export class ReporteService {
  async generar(desdeQ?: string, hastaQ?: string) {
    await expirarVencidos();

    let hasta = /^\d{4}-\d{2}-\d{2}$/.test(hastaQ ?? '') ? hastaQ! : fechaPeruMenosDias(0);
    let desde = /^\d{4}-\d{2}-\d{2}$/.test(desdeQ ?? '') ? desdeQ! : fechaPeruMenosDias(29);
    if (desde > hasta) [desde, hasta] = [hasta, desde];

    const rango: [Date, Date] = [inicioDelDia(desde)!, finDelDia(hasta)!];

    const [porDia, metodos, comprobantes, top, categorias, clientes, estados, comprasDia, proveedores, inventario] =
      await Promise.all([
        repo.ventasPorDia(rango), repo.ventasPorMetodo(rango), repo.ventasPorComprobante(rango),
        repo.topProductos(rango), repo.ventasPorCategoria(rango), repo.topClientes(rango),
        repo.pedidosPorEstado(rango), repo.comprasPorDia(rango), repo.comprasPorProveedor(rango),
        repo.inventario()
      ]);

    const totalVentas = redondear2(porDia.reduce((a, x) => a + x.total, 0));
    const cantVentas = porDia.reduce((a, x) => a + x.cantidad, 0);
    const totalCompras = redondear2(comprasDia.reduce((a, x) => a + x.total, 0));
    const cantCompras = comprasDia.reduce((a, x) => a + x.cantidad, 0);

    return {
      rango: { desde, hasta },
      ventas: {
        cantidad: cantVentas,
        total: totalVentas,
        ticketPromedio: cantVentas ? redondear2(totalVentas / cantVentas) : 0,
        porDia: completarDias(desde, hasta, porDia, { cantidad: 0, total: 0 }),
        porMetodo: metodos,
        porComprobante: comprobantes
      },
      productos: { masVendidos: top, porCategoria: categorias },
      clientes: { top: clientes },
      pedidos: { porEstado: estados },
      compras: {
        cantidad: cantCompras,
        total: totalCompras,
        porDia: completarDias(desde, hasta, comprasDia, { cantidad: 0, total: 0 }),
        porProveedor: proveedores
      },
      inventario
    };
  }
}

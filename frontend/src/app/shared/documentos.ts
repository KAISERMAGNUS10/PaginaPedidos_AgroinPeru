import { etiquetaMetodo, fechaHora, numero, soles, textoEstadoPedido } from './formato';

/*
 * Documentos con el formato de la empresa: boleta / factura y reportes.
 * Cada uno se genera como una página HTML independiente que se imprime en un
 * iframe, así el PDF contiene solo el documento y no la pantalla del panel.
 */

/** Datos de la empresa que aparecen en los documentos. */
export const EMPRESA = {
  ruc: '20603299494',
  razonSocial: 'AGROINPERU SAC',
  nombreComercial: 'AGROINPERU S.A.C',
  direccion: 'AV. REPUBLICA DE ARGENTINA NÚMERO 327 URB. LIMA INDUSTRIAL LIMA - LIMA - LIMA',
  telefono: '934757123 / 934665464',
  email: 'agroinperu@gmail.com',
  logo: 'img/logoagroperu.jpg',
  bancos: [{ banco: 'BCP', moneda: 'Soles', cuenta: '194-2302206-0-74', cci: '002-194-002302206074-15' }]
};

/** Lo que necesita un documento de una venta (lo cumplen los tickets de caja, ventas y almacén). */
export interface VentaDocumento {
  id: string;
  comprobante?: string;
  tipoComprobante: 'boleta' | 'factura';
  nombreFacturacion: string;
  documentoTipo: string;
  documentoNumero: string;
  correo: string;
  telefono: string;
  subtotal: number;
  igv: number;
  total: number;
  estado: string;
  metodoPago?: string;
  montoRecibido?: number;
  vueltoEntregado?: number;
  numOperacion?: string;
  fechaEmision: string;
  fechaPago?: string;
  fechaEntrega?: string;
  personaAutorizada: { nombre: string; dni: string } | null;
  productos: Array<{ nombre: string; cantidad: number; precio: number; subtotal: number }>;
}

type Celda = string | number | string[];

export interface TablaReporte {
  titulo?: string;
  columnas: Array<{ titulo: string; derecha?: boolean }>;
  filas: Celda[][];
}

export interface DatosReporte {
  titulo: string;
  modulo: string;
  desde?: string;
  hasta?: string;
  kpis: Array<{ etiqueta: string; valor: string }>;
  tablas: TablaReporte[];
}

/* ------------------------------------------------------------------ */
/* Utilidades                                                          */
/* ------------------------------------------------------------------ */

/** Todo dato del usuario pasa por aquí antes de entrar al HTML del documento. */
function esc(valor: unknown): string {
  return String(valor ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!
  );
}

function dinero(valor: number): string {
  return Number(valor ?? 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fechaCorta(iso: string | null | undefined): string {
  if (!iso) return '—';
  const f = new Date(iso);
  return `${String(f.getDate()).padStart(2, '0')}/${String(f.getMonth() + 1).padStart(2, '0')}/${f.getFullYear()}`;
}

function urlLogo(): string {
  return `${window.location.origin}/${EMPRESA.logo}`;
}

const UNIDADES = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
const DIEZ_A_19 = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISEIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
const VEINTES = ['VEINTE', 'VEINTIUN', 'VEINTIDOS', 'VEINTITRES', 'VEINTICUATRO', 'VEINTICINCO', 'VEINTISEIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE'];
const DECENAS = ['', '', '', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
const CENTENAS = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

function hasta999(n: number): string {
  if (n === 100) return 'CIEN';
  const resto = n % 100;
  let texto = '';
  if (resto < 10) texto = UNIDADES[resto];
  else if (resto < 20) texto = DIEZ_A_19[resto - 10];
  else if (resto < 30) texto = VEINTES[resto - 20];
  else texto = DECENAS[Math.floor(resto / 10)] + (resto % 10 ? ` Y ${UNIDADES[resto % 10]}` : '');
  return [CENTENAS[Math.floor(n / 100)], texto].filter(Boolean).join(' ');
}

function enteroEnLetras(n: number): string {
  if (n === 0) return 'CERO';
  const millones = Math.floor(n / 1_000_000);
  const miles = Math.floor((n % 1_000_000) / 1000);
  const partes = [
    millones === 1 ? 'UN MILLON' : millones > 1 ? `${hasta999(millones)} MILLONES` : '',
    miles === 1 ? 'MIL' : miles > 1 ? `${hasta999(miles)} MIL` : '',
    hasta999(n % 1000)
  ];
  return partes.filter(Boolean).join(' ');
}

/** 119.9 → "SON: CIENTO DIECINUEVE Y 90/100 SOLES" */
export function montoEnLetras(monto: number): string {
  const centimos = Math.round(Number(monto ?? 0) * 100);
  const entero = Math.floor(centimos / 100);
  return `SON: ${enteroEnLetras(entero)} Y ${String(centimos % 100).padStart(2, '0')}/100 SOLES`;
}

/* ------------------------------------------------------------------ */
/* Página base                                                         */
/* ------------------------------------------------------------------ */

/*
 * @page con margen 0 quita el encabezado y el pie que agrega el navegador
 * (fecha y URL). Los márgenes reales los ponen las filas .espacio de .hoja,
 * que se repiten en cada página impresa.
 */
const ESTILOS_BASE = `
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body { font-family: Arial, Helvetica, sans-serif; color: #1a1a1a; font-size: 12.5px; }
  .hoja { width: 100%; border-collapse: collapse; }
  .hoja > thead > tr > td, .hoja > tfoot > tr > td, .hoja > tbody > tr > td { padding: 0; }
  .espacio { height: 12mm; }
  .contenido { padding: 0 14mm; }
  /* El JPG tiene un fondo gris muy claro: este ajuste lo vuelve blanco como la hoja. */
  .logo { display: block; object-fit: contain; filter: brightness(1.04); }
  @media screen {
    .espacio { display: none; }
    .contenido { padding: 22px; min-width: 620px; }
  }
`;

function pagina(titulo: string, estilos: string, cuerpo: string): string {
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>${esc(titulo)}</title>
<style>${ESTILOS_BASE}${estilos}</style></head>
<body><table class="hoja">
<thead><tr><td><div class="espacio"></div></td></tr></thead>
<tfoot><tr><td><div class="espacio"></div></td></tr></tfoot>
<tbody><tr><td><div class="contenido documento">${cuerpo}</div></td></tr></tbody>
</table></body></html>`;
}

/* ------------------------------------------------------------------ */
/* Boleta / factura                                                    */
/* ------------------------------------------------------------------ */

const ESTILOS_COMPROBANTE = `
  .cab { display: flex; justify-content: space-between; align-items: flex-start; gap: 14px; margin-bottom: 10px; }
  .cab .logo { width: 120px; height: 165px; }
  .caja-ruc { border: 2px solid #333; border-radius: 3px; text-align: center; min-width: 260px; }
  .caja-ruc div { padding: 8px 10px; font-weight: bold; }
  .caja-ruc .ruc { font-size: 12px; border-bottom: 1px solid #333; }
  .caja-ruc .tipo { font-size: 12px; background: #1565c0; color: #fff; border-bottom: 1px solid #333; }
  .caja-ruc .numero { font-size: 13.5px; }
  .empresa { font-weight: bold; font-size: 14px; margin: 2px 0 3px; }
  .empresa-datos { font-size: 11px; color: #333; line-height: 1.5; margin-bottom: 14px; }
  .datos { display: flex; justify-content: space-between; gap: 16px; font-size: 12px; line-height: 1.8; margin-bottom: 6px; }
  .datos span { color: #444; }
  .forma-pago { font-size: 12px; margin: 4px 0 14px; }
  table.productos { width: 100%; border-collapse: collapse; font-size: 11.5px; margin-bottom: 10px; }
  table.productos th { background: #c9c9c9; padding: 8px 6px; text-align: left; border: 1px solid #b0b0b0; }
  table.productos td { padding: 7px 6px; border: 1px solid #e2e2e2; }
  table.productos tr { break-inside: avoid; }
  table.productos .der { text-align: right; white-space: nowrap; }
  .son { text-align: center; font-size: 12px; font-weight: bold; margin: 10px 0; }
  .totales { width: 290px; margin: 0 0 14px auto; font-size: 12px; break-inside: avoid; }
  .totales div { display: grid; grid-template-columns: 1fr 30px 80px; padding: 3px 0; }
  .totales strong { text-align: right; }
  .totales .final { border-top: 1px solid #ccc; margin-top: 4px; padding-top: 6px; font-weight: bold; }
  .totales .final strong { font-size: 13.5px; }
  .bancos { border: 1px solid #ddd; border-radius: 4px; padding: 8px 10px 10px; margin-bottom: 14px; break-inside: avoid; }
  .bancos .titulo { text-align: center; font-size: 11px; font-weight: bold; margin-bottom: 6px; }
  .bancos table { width: 100%; border-collapse: collapse; font-size: 11px; }
  .bancos th { background: #1565c0; color: #fff; padding: 5px 6px; text-align: left; }
  .bancos td { padding: 5px 6px; border-bottom: 1px solid #eee; }
  .pie { text-align: center; font-size: 10.5px; color: #555; line-height: 1.6; break-inside: avoid; }
  .pie p { margin: 3px 0; }
`;

function etiquetaDocumento(tipo: string): string {
  const mapa: Record<string, string> = { DNI: 'D.N.I.', RUC: 'R.U.C.', CE: 'C.E.', 'CE/Pasaporte': 'C.E. / Pasaporte' };
  return mapa[tipo] ?? (tipo || 'Documento');
}

/** "Boleta B001-00000392": también es el nombre sugerido del PDF. */
export function tituloComprobante(v: VentaDocumento): string {
  return `${v.tipoComprobante === 'factura' ? 'Factura' : 'Boleta'} ${v.comprobante ?? v.id}`;
}

export function htmlComprobante(v: VentaDocumento): string {
  const tipo = v.tipoComprobante === 'factura' ? 'FACTURA ELECTRÓNICA' : 'BOLETA DE VENTA ELECTRÓNICA';
  const operacion = v.numOperacion ? ` · Op. ${v.numOperacion}` : '';

  const filas = v.productos.map(p => `
    <tr>
      <td class="der">${Number(p.cantidad).toFixed(2)}</td>
      <td>UNID.</td>
      <td>${esc(p.nombre)}</td>
      <td class="der">${dinero(p.precio)}</td>
      <td class="der">${dinero(p.subtotal)}</td>
    </tr>`).join('');

  const bancos = EMPRESA.bancos.map(b =>
    `<tr><td>${esc(b.banco)}</td><td>${esc(b.moneda)}</td><td>${esc(b.cuenta)}</td><td>${esc(b.cci)}</td></tr>`
  ).join('');

  return pagina(tituloComprobante(v), ESTILOS_COMPROBANTE, `
    <div class="cab">
      <img class="logo" src="${esc(urlLogo())}" alt="${esc(EMPRESA.razonSocial)}">
      <div class="caja-ruc">
        <div class="ruc">R.U.C. ${esc(EMPRESA.ruc)}</div>
        <div class="tipo">${tipo}</div>
        <div class="numero">N° : ${esc(v.comprobante ?? v.id)}</div>
      </div>
    </div>

    <div class="empresa">${esc(EMPRESA.razonSocial)}</div>
    <div class="empresa-datos">
      ${esc(EMPRESA.direccion)}<br>
      Teléfono : ${esc(EMPRESA.telefono)} &nbsp; Email : ${esc(EMPRESA.email)}
    </div>

    <div class="datos">
      <div>
        <div><span>${v.tipoComprobante === 'factura' ? 'Razón Social' : 'Cliente'}</span> : <strong>${esc(v.nombreFacturacion)}</strong></div>
        <div><span>${esc(etiquetaDocumento(v.documentoTipo))}</span> : <strong>${esc(v.documentoNumero)}</strong></div>
        <div><span>Dirección</span> : <strong>No se registra dirección</strong></div>
      </div>
      <div>
        <div><span>Moneda</span> : <strong>SOLES</strong></div>
        <div><span>Fecha Emisión</span> : <strong>${fechaCorta(v.fechaPago ?? v.fechaEmision)}</strong></div>
        <div><span>Ticket</span> : <strong>${esc(v.id)}</strong></div>
      </div>
    </div>

    <div class="forma-pago">Forma de Pago : Contado -- ${esc(v.metodoPago ?? 'Efectivo')} ventas menores${esc(operacion)}</div>

    <table class="productos">
      <thead><tr><th class="der">Cant.</th><th>U/M</th><th>Descripción</th><th class="der">Precio Unitario</th><th class="der">Importe Total</th></tr></thead>
      <tbody>${filas}</tbody>
    </table>

    <div class="son">${esc(montoEnLetras(v.total))}</div>
    <div class="totales">
      <div><span>Venta Gravada :</span><span>S/</span><strong>${dinero(v.subtotal)}</strong></div>
      <div><span>Total I.G.V. :</span><span>S/</span><strong>${dinero(v.igv)}</strong></div>
      <div class="final"><span>Total Precio de Venta :</span><span>S/</span><strong>${dinero(v.total)}</strong></div>
    </div>

    <div class="bancos">
      <div class="titulo">"SÍRVASE ABONAR EN NUESTRAS CUENTAS"</div>
      <table>
        <thead><tr><th>Banco</th><th>Moneda</th><th>Cuenta</th><th>CCI</th></tr></thead>
        <tbody>${bancos}</tbody>
      </table>
    </div>

    <div class="pie">
      <p>"GRACIAS POR SU PREFERENCIA"</p>
      <p>Para visualizar el presente documento ingrese a: <strong>cpe.telemovil.global</strong> o en http://www.sunat.gob.pe con su clave SOL.</p>
      <p>Representación impresa de la ${tipo} . Autorizado mediante la Resolución: N° 034-030-0000103/SUNAT</p>
      <p>www.facturaonline.pe</p>
    </div>
  `);
}

/* ------------------------------------------------------------------ */
/* Reportes                                                            */
/* ------------------------------------------------------------------ */

const AZUL_REPORTE = '#12467f';

const ESTILOS_REPORTE = `
  .cab { display: flex; align-items: center; gap: 18px; padding-bottom: 12px; border-bottom: 2px solid ${AZUL_REPORTE}; margin-bottom: 16px; }
  .cab .logo { width: 86px; height: 108px; }
  .cab h1 { margin: 0 0 4px; font-size: 21px; color: ${AZUL_REPORTE}; }
  .cab p { margin: 1px 0; font-size: 11.5px; color: #333; }
  .kpis { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 16px; }
  .kpi { border: 1px solid #bbb; padding: 8px 12px; min-width: 150px; }
  .kpi small { display: block; font-size: 9.5px; text-transform: uppercase; color: #444; margin-bottom: 3px; }
  .kpi strong { font-size: 15px; }
  /* Las tablas cortas no se parten entre páginas; una tabla larga sí continúa en la siguiente. */
  .seccion { break-inside: avoid; }
  h2 { font-size: 13px; color: ${AZUL_REPORTE}; margin: 16px 0 6px; break-after: avoid; }
  table.datos { width: 100%; border-collapse: collapse; font-size: 9.5px; }
  table.datos thead { display: table-header-group; }
  table.datos th { background: #eee; border: 1px solid #bbb; padding: 5px 6px; text-align: left; font-weight: bold; }
  table.datos td { border: 1px solid #ccc; padding: 5px 6px; vertical-align: top; }
  table.datos tr { break-inside: avoid; }
  table.datos .der { text-align: right; white-space: nowrap; }
  .sin-datos { font-size: 11px; color: #555; margin: 0; }
`;

function celda(c: Celda): string {
  return Array.isArray(c) ? c.map(esc).join('<br>') : esc(c);
}

function htmlTabla(t: TablaReporte): string {
  const titulo = t.titulo ? `<h2>${esc(t.titulo)}</h2>` : '';
  if (t.filas.length === 0) return `<section class="seccion">${titulo}<p class="sin-datos">Sin datos en el periodo.</p></section>`;

  const cabecera = t.columnas.map(c => `<th${c.derecha ? ' class="der"' : ''}>${esc(c.titulo)}</th>`).join('');
  const filas = t.filas.map(f =>
    `<tr>${f.map((c, i) => `<td${t.columnas[i]?.derecha ? ' class="der"' : ''}>${celda(c)}</td>`).join('')}</tr>`
  ).join('');

  return `<section class="seccion">${titulo}<table class="datos"><thead><tr>${cabecera}</tr></thead><tbody>${filas}</tbody></table></section>`;
}

export function tituloReporte(r: DatosReporte): string {
  return r.desde ? `${r.titulo} ${r.desde} al ${r.hasta}` : r.titulo;
}

export function htmlReporte(r: DatosReporte): string {
  const kpis = r.kpis.map(k => `<div class="kpi"><small>${esc(k.etiqueta)}</small><strong>${esc(k.valor)}</strong></div>`).join('');

  return pagina(tituloReporte(r), ESTILOS_REPORTE, `
    <div class="cab">
      <img class="logo" src="${esc(urlLogo())}" alt="${esc(EMPRESA.razonSocial)}">
      <div>
        <h1>${esc(r.titulo)}</h1>
        <p>${esc(EMPRESA.nombreComercial)} · ${esc(r.modulo)}</p>
        ${r.desde ? `<p>Rango: ${esc(r.desde)} al ${esc(r.hasta)}</p>` : ''}
        <p>Generado: ${esc(new Date().toLocaleString('es-PE'))}</p>
      </div>
    </div>
    <div class="kpis">${kpis}</div>
    ${r.tablas.map(htmlTabla).join('')}
  `);
}

function lineasProductos(v: VentaDocumento): string[] {
  return v.productos.map(p => `${p.cantidad}x ${p.nombre}`);
}

/** Reporte de ventas: el mismo para Caja y para Administración. */
export function reporteVentas(ventas: VentaDocumento[], modulo: string, desde: string, hasta: string): DatosReporte {
  return {
    titulo: 'Reporte de ventas',
    modulo,
    desde,
    hasta,
    kpis: [
      { etiqueta: 'N° de ventas', valor: numero(ventas.length) },
      { etiqueta: 'Total vendido', valor: soles(ventas.reduce((a, v) => a + v.total, 0)) }
    ],
    tablas: [{
      columnas: [
        { titulo: 'Ticket' }, { titulo: 'Fecha de pago' }, { titulo: 'Cliente' }, { titulo: 'Documento' },
        { titulo: 'Método' }, { titulo: 'Productos' }, { titulo: 'Total', derecha: true }
      ],
      filas: ventas.map(v => [
        v.id, fechaHora(v.fechaPago), v.nombreFacturacion, v.documentoNumero,
        v.metodoPago ?? '—', lineasProductos(v), soles(v.total)
      ])
    }]
  };
}

/** Reporte de entregas del módulo de Almacén. */
export function reporteEntregas(pedidos: VentaDocumento[], unidades: number, desde: string, hasta: string): DatosReporte {
  return {
    titulo: 'Reporte de entregas',
    modulo: 'Módulo de Almacén',
    desde,
    hasta,
    kpis: [
      { etiqueta: 'Pedidos entregados', valor: numero(pedidos.length) },
      { etiqueta: 'Unidades entregadas', valor: numero(unidades) }
    ],
    tablas: [{
      columnas: [
        { titulo: 'Ticket' }, { titulo: 'Entregado' }, { titulo: 'Cliente' }, { titulo: 'Documento' },
        { titulo: 'Recogió' }, { titulo: 'Productos' }
      ],
      filas: pedidos.map(t => [
        t.id, fechaHora(t.fechaEntrega), t.nombreFacturacion, t.documentoNumero,
        t.personaAutorizada ? `${t.personaAutorizada.nombre} (DNI ${t.personaAutorizada.dni})` : 'Titular',
        lineasProductos(t)
      ])
    }]
  };
}

/** Reporte general de Administración, con los mismos datos de la pantalla Reportes. */
export function reporteGeneral(d: any): DatosReporte {
  const conMovimiento = (dias: any[]) => dias.filter(x => x.cantidad > 0);

  return {
    titulo: 'Reporte general',
    modulo: 'Administración',
    desde: d.rango.desde,
    hasta: d.rango.hasta,
    kpis: [
      { etiqueta: `Ventas (${numero(d.ventas.cantidad)})`, valor: soles(d.ventas.total) },
      { etiqueta: 'Ticket promedio', valor: soles(d.ventas.ticketPromedio) },
      { etiqueta: `Compras (${numero(d.compras.cantidad)})`, valor: soles(d.compras.total) },
      { etiqueta: 'Ventas − Compras', valor: soles(d.ventas.total - d.compras.total) },
      { etiqueta: `Inventario (${numero(d.inventario.unidades)} u.)`, valor: soles(d.inventario.valorVenta) }
    ],
    tablas: [
      {
        titulo: 'Ventas por día',
        columnas: [{ titulo: 'Fecha' }, { titulo: 'N° de ventas', derecha: true }, { titulo: 'Total', derecha: true }],
        filas: conMovimiento(d.ventas.porDia).map((x: any) => [x.fecha, numero(x.cantidad), soles(x.total)])
      },
      {
        titulo: 'Ventas por método de pago',
        columnas: [{ titulo: 'Método' }, { titulo: 'N° de ventas', derecha: true }, { titulo: 'Total', derecha: true }],
        filas: d.ventas.porMetodo.map((m: any) => [etiquetaMetodo(m.metodo), numero(m.cantidad), soles(m.total)])
      },
      {
        titulo: 'Boletas y facturas',
        columnas: [{ titulo: 'Comprobante' }, { titulo: 'Cantidad', derecha: true }, { titulo: 'Total', derecha: true }],
        filas: d.ventas.porComprobante.map((m: any) => [m.tipo === 'FACTURA' ? 'Facturas' : 'Boletas', numero(m.cantidad), soles(m.total)])
      },
      {
        titulo: 'Productos más vendidos',
        columnas: [{ titulo: 'SKU' }, { titulo: 'Producto' }, { titulo: 'Categoría' }, { titulo: 'Unidades', derecha: true }, { titulo: 'Total', derecha: true }],
        filas: d.productos.masVendidos.map((p: any) => [p.sku, p.nombre, p.categoria, numero(p.unidades), soles(p.total)])
      },
      {
        titulo: 'Ventas por categoría',
        columnas: [{ titulo: 'Categoría' }, { titulo: 'Unidades', derecha: true }, { titulo: 'Total', derecha: true }],
        filas: d.productos.porCategoria.map((c: any) => [c.categoria, numero(c.unidades), soles(c.total)])
      },
      {
        titulo: 'Mejores clientes',
        columnas: [{ titulo: 'Cliente' }, { titulo: 'Documento' }, { titulo: 'Pedidos', derecha: true }, { titulo: 'Total', derecha: true }],
        filas: d.clientes.top.map((c: any) => [c.cliente, c.documento, numero(c.pedidos), soles(c.total)])
      },
      {
        titulo: 'Compras por día',
        columnas: [{ titulo: 'Fecha' }, { titulo: 'N° de compras', derecha: true }, { titulo: 'Total', derecha: true }],
        filas: conMovimiento(d.compras.porDia).map((x: any) => [x.fecha, numero(x.cantidad), soles(x.total)])
      },
      {
        titulo: 'Compras por proveedor',
        columnas: [{ titulo: 'Proveedor' }, { titulo: 'Compras', derecha: true }, { titulo: 'Total', derecha: true }],
        filas: d.compras.porProveedor.map((p: any) => [p.proveedor, numero(p.cantidad), soles(p.total)])
      },
      {
        titulo: 'Pedidos por estado',
        columnas: [{ titulo: 'Estado' }, { titulo: 'Pedidos', derecha: true }],
        filas: Object.entries(d.pedidos.porEstado).map(([e, n]) => [textoEstadoPedido(e), numero(n as number)])
      },
      {
        titulo: 'Inventario crítico',
        columnas: [{ titulo: 'SKU' }, { titulo: 'Producto' }, { titulo: 'Stock', derecha: true }, { titulo: 'Mínimo', derecha: true }],
        filas: d.inventario.criticos.map((p: any) => [p.sku, p.nombre, numero(p.stock), numero(p.stockMinimo)])
      }
    ]
  };
}

/* ------------------------------------------------------------------ */
/* Impresión                                                           */
/* ------------------------------------------------------------------ */

const ID_MARCO_OCULTO = 'ap-marco-impresion';

/** Imprime un iframe ya cargado. El título de la pestaña sugiere el nombre del PDF. */
export function imprimirMarco(marco: HTMLIFrameElement, titulo: string): void {
  const ventana = marco.contentWindow;
  if (!ventana) return;

  const tituloOriginal = document.title;
  document.title = titulo;
  ventana.focus();
  ventana.print();
  setTimeout(() => (document.title = tituloOriginal), 1000);
}

/** Abre el diálogo de impresión con un documento, sin mostrarlo antes en pantalla. */
export function imprimirHtml(html: string, titulo: string): void {
  document.getElementById(ID_MARCO_OCULTO)?.remove();

  const marco = document.createElement('iframe');
  marco.id = ID_MARCO_OCULTO;
  marco.title = titulo;
  marco.setAttribute('aria-hidden', 'true');
  marco.style.cssText = 'position:absolute;left:-9999px;width:0;height:0;border:0';
  // "load" espera también al logo, para que no salga en blanco.
  marco.addEventListener('load', () => imprimirMarco(marco, titulo), { once: true });
  marco.srcdoc = html;
  document.body.appendChild(marco);
}

export function imprimirReporte(r: DatosReporte): void {
  imprimirHtml(htmlReporte(r), tituloReporte(r));
}

export function imprimirComprobante(v: VentaDocumento): void {
  imprimirHtml(htmlComprobante(v), tituloComprobante(v));
}

/** Formatos y utilidades comunes del panel. */

export function soles(valor: number | null | undefined): string {
  return 'S/ ' + Number(valor ?? 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** S/ 5.62 M, S/ 12.4 mil... para cifras grandes en tarjetas. */
export function solesCorto(valor: number | null | undefined): string {
  const v = Number(valor ?? 0);
  if (Math.abs(v) >= 1_000_000) return 'S/ ' + (v / 1_000_000).toLocaleString('es-PE', { maximumFractionDigits: 2 }) + ' M';
  return soles(v);
}

export function plural(n: number, singular: string, plural: string): string {
  return `${n.toLocaleString('es-PE')} ${n === 1 ? singular : plural}`;
}

export function numero(valor: number | null | undefined): string {
  return Number(valor ?? 0).toLocaleString('es-PE');
}

export function fecha(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function fechaHora(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-PE', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

export function horaCorta(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
}

/** Fecha YYYY-MM-DD en hora local del navegador, N días atrás. */
export function diaISO(diasAtras = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - diasAtras);
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

/** "hace 5 min", "hace 2 h", "hace 3 d". */
export function hace(iso: string | null | undefined): string {
  if (!iso) return '—';
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} d`;
}

/** Horas que faltan para vencer (negativo = ya venció). */
export function horasRestantes(iso: string | null | undefined): number {
  if (!iso) return 0;
  return (new Date(iso).getTime() - Date.now()) / 3600000;
}

export function textoVence(iso: string | null | undefined): string {
  const h = horasRestantes(iso);
  if (h <= 0) return 'Vencido';
  if (h < 1) return `Vence en ${Math.max(1, Math.round(h * 60))} min`;
  if (h < 48) return `Vence en ${Math.floor(h)} h`;
  return `Vence en ${Math.floor(h / 24)} d`;
}

export function etiquetaMetodo(m: string | null | undefined): string {
  const mapa: Record<string, string> = {
    EFECTIVO: 'Efectivo', TARJETA_DEBITO: 'Tarjeta débito', TARJETA_CREDITO: 'Tarjeta crédito',
    YAPE: 'Yape', PLIN: 'Plin', TRANSFERENCIA: 'Transferencia'
  };
  return (m && mapa[m]) || m || '—';
}

/** Descarga un CSV (compatible con Excel: UTF-8 con BOM, separador ;). */
export function descargarCsv(nombreArchivo: string, columnas: string[], filas: Array<Array<string | number | null | undefined>>): void {
  const esc = (v: unknown) => {
    const t = v === null || v === undefined ? '' : String(v);
    return /[";\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const contenido = [columnas, ...filas].map(f => f.map(esc).join(';')).join('\r\n');
  const blob = new Blob(['\uFEFF' + contenido], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo.endsWith('.csv') ? nombreArchivo : `${nombreArchivo}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function inicial(nombre: string | null | undefined): string {
  return (nombre ?? '?').trim().charAt(0).toUpperCase() || '?';
}

export function claseEstadoPedido(e: string | null | undefined): string {
  switch (e) {
    case 'VIGENTE': return 'ap-b-azul';
    case 'LISTO_PARA_RECOJO': return 'ap-b-ambar';
    case 'PAGADO': return 'ap-b-verde';
    case 'ENTREGADO': return 'ap-b-violeta';
    default: return 'ap-b-gris';
  }
}

export function textoEstadoPedido(e: string | null | undefined): string {
  const m: Record<string, string> = {
    VIGENTE: 'En preparación', LISTO_PARA_RECOJO: 'Listo para recojo', PAGADO: 'Pagado',
    ENTREGADO: 'Entregado', CANCELADO: 'Cancelado', EXPIRADO: 'Expirado'
  };
  return (e && m[e]) || e || '—';
}

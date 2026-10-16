/*
 * Perú no usa horario de verano: UTC-05:00 todo el año.
 * Los filtros "desde / hasta" que envía el frontend (YYYY-MM-DD) se
 * interpretan como días en hora de Perú.
 */
const OFFSET = process.env.TZ_OFFSET ?? '-05:00';

export function aIso(valor: Date | string | null | undefined): string | null {
  if (!valor) return null;
  const d = valor instanceof Date ? valor : new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function inicioDelDia(yyyyMmDd?: string): Date | null {
  if (!yyyyMmDd || !/^\d{4}-\d{2}-\d{2}$/.test(yyyyMmDd)) return null;
  const d = new Date(`${yyyyMmDd}T00:00:00.000${OFFSET}`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function finDelDia(yyyyMmDd?: string): Date | null {
  if (!yyyyMmDd || !/^\d{4}-\d{2}-\d{2}$/.test(yyyyMmDd)) return null;
  const d = new Date(`${yyyyMmDd}T23:59:59.999${OFFSET}`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function offsetZona(): string {
  return OFFSET;
}

/** YYYY-MM-DD del día de hoy (hora de Perú) menos N días. */
export function fechaPeruMenosDias(dias: number): string {
  const sign = OFFSET.startsWith('-') ? -1 : 1;
  const [h, m] = OFFSET.slice(1).split(':').map(Number);
  const offsetMs = sign * (h * 60 + m) * 60000;
  const local = new Date(Date.now() + offsetMs - dias * 86400000);
  return local.toISOString().slice(0, 10);
}

export function redondear2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

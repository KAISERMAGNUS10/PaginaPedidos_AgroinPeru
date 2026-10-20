// Utilidades de interfaz: toasts, validación visual y etiquetas de estado.

export type TipoToast = 'success' | 'warning' | 'error' | 'info';

function asegurarContenedorToast(): HTMLElement {
  let contenedor = document.getElementById('agro-ui-toast-container');
  if (!contenedor) {
    contenedor = document.createElement('div');
    contenedor.id = 'agro-ui-toast-container';
    contenedor.className = 'agro-ui-toast-container';
    document.body.appendChild(contenedor);
  }
  return contenedor;
}

function toast(message: string, type?: TipoToast, title?: string): void {
  const tipo: TipoToast = type || 'info';
  const icons: Record<TipoToast, string> = { success: '✓', warning: '⚠', error: '✕', info: 'ℹ' };
  const titles: Record<TipoToast, string> = {
    success: 'Operación realizada',
    warning: 'Atención',
    error: 'No se pudo completar',
    info: 'Información'
  };
  const contenedor = asegurarContenedorToast();
  const nodo = document.createElement('div');
  nodo.className = 'agro-ui-toast is-' + tipo;
  nodo.innerHTML =
    '<div class="agro-ui-toast-icon">' + (icons[tipo] || icons.info) + '</div>' +
    '<div><strong>' + (title || titles[tipo] || titles.info) + '</strong><span></span></div>';
  const span = nodo.querySelector('span');
  if (span) span.textContent = message;
  contenedor.appendChild(nodo);
  requestAnimationFrame(() => nodo.classList.add('is-visible'));
  setTimeout(() => {
    nodo.classList.remove('is-visible');
    setTimeout(() => nodo.remove(), 250);
  }, 3600);
}

function setFieldState(
  input: HTMLInputElement | null,
  valid: boolean | null,
  message?: string,
  errorElement?: HTMLElement | null
): void {
  if (!input) return;
  input.classList.toggle('input-invalid', valid === false);
  input.classList.toggle('input-valid', valid === true && !!input.value && input.value.trim().length > 0);
  if (errorElement) errorElement.textContent = valid === false ? (message || 'Revisa este campo.') : '';
}

function statusLabel(status?: string): string {
  const labels: Record<string, string> = {
    VIGENTE: 'EN PREPARACIÓN',
    LISTO_PARA_RECOJO: 'LISTO PARA RECOJO',
    PAGADO: 'PAGADO',
    ENTREGADO: 'ENTREGADO',
    CANCELADO: 'CANCELADO',
    EXPIRADO: 'EXPIRADO'
  };
  return (status && labels[status]) || status || '—';
}

export const AgroUI = { toast, setFieldState, statusLabel };

// Algunas páginas preguntan "if (window.AgroUI)", así que se publica también en window (solo navegador).
if (typeof window !== 'undefined') {
  (window as any).AgroUI = AgroUI;
}

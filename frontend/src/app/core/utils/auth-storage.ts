// @ts-nocheck
// Sesión del usuario (en localStorage) + token JWT que entrega el backend.
import { irA } from './navegacion';

const CLAVE_SESION = 'agro_sesion_usuario';

export function codificarDatos(datos) {
    return btoa(encodeURIComponent(JSON.stringify(datos)));
}

export function decodificarDatos(valor) {
    return JSON.parse(decodeURIComponent(atob(valor)));
}

/** Guarda la sesión. `datos` debe incluir `token` (JWT) cuando viene del login. */
export function guardarSesionSegura(datos) {
    const payload = Object.assign({}, datos, { loginTime: Date.now() });
    localStorage.setItem(CLAVE_SESION, codificarDatos(payload));
}

export function limpiarSesionSegura() {
    localStorage.removeItem(CLAVE_SESION);
}

/** Fecha de expiración (ms) del JWT; null si no se puede leer. */
function expiracionToken(token) {
    try {
        const cuerpo = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        const exp = JSON.parse(atob(cuerpo)).exp;
        return typeof exp === 'number' ? exp * 1000 : null;
    } catch (e) {
        return null;
    }
}

export function obtenerSesionSegura(opciones?: any) {
    const config = Object.assign({ redirigirSiInvalida: false }, opciones || {});
    if (typeof localStorage === 'undefined') return null; // SSR: no hay localStorage en el servidor
    const crudo = localStorage.getItem(CLAVE_SESION);

    if (!crudo) {
        if (config.redirigirSiInvalida) irA('/login');
        return null;
    }

    let sesion = null;
    try {
        sesion = decodificarDatos(crudo);
    } catch (e) {
        sesion = null;
    }

    // La sesión vence cuando vence el token del backend (JWT_EXPIRES_IN).
    const expToken = sesion && sesion.token ? expiracionToken(sesion.token) : null;
    const expirada = !sesion || !sesion.token
        || (expToken !== null && Date.now() > expToken);

    if (expirada) {
        limpiarSesionSegura();
        if (config.redirigirSiInvalida) irA('/login');
        return null;
    }

    return sesion;
}

export function obtenerToken() {
    const sesion = obtenerSesionSegura();
    return sesion ? sesion.token : null;
}

/** Estado "efectivo" del ticket (el backend ya expira los pedidos, esto es solo respaldo visual). */
export function obtenerEstadoTicketActualizado(ticket, ahora) {
    if (!ticket) return 'VIGENTE';

    const estado = ticket.estado || 'VIGENTE';
    if (['PAGADO', 'ENTREGADO', 'CANCELADO', 'EXPIRADO'].includes(estado)) return estado;

    if (ticket.fechaExpiracion) {
        const expira = new Date(ticket.fechaExpiracion).getTime();
        const referencia = ahora instanceof Date ? ahora.getTime() : (typeof ahora === 'number' ? ahora : Date.now());
        if (Number.isFinite(expira) && referencia > expira) return 'EXPIRADO';
    }

    return estado;
}

/** Id del ticket que se está viendo en /ticket (se guarda al crear el pedido o desde Mis Pedidos). */
export function guardarTicketActualId(id) {
    if (!id) sessionStorage.removeItem('agro_ticket_actual_id');
    else sessionStorage.setItem('agro_ticket_actual_id', id);
}

export function obtenerTicketActualId() {
    return sessionStorage.getItem('agro_ticket_actual_id');
}

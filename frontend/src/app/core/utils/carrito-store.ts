// @ts-nocheck
// Carrito del cliente: se usa desde localStorage (rápido y permite comprar como invitado)
// y, cuando hay un CLIENTE con sesión, se refleja en el backend (tbl_carrito).
import { api } from './api';
import { obtenerSesionSegura } from './auth-storage';

const CLAVE = 'agro_carrito_obj';
let temporizador = null;

export function leerCarrito() {
    try {
        return JSON.parse(localStorage.getItem(CLAVE)) || {};
    } catch (e) {
        return {};
    }
}

function esCliente() {
    const sesion = obtenerSesionSegura();
    return !!sesion && sesion.Rol === 'CLIENTE';
}

function empujarAlServidor(carrito) {
    if (!esCliente()) return;
    clearTimeout(temporizador);
    temporizador = setTimeout(() => {
        const items = Object.keys(carrito).map(id => ({
            id,
            qty: carrito[id].qty !== undefined ? carrito[id].qty : carrito[id].cantidad
        }));
        const peticion = items.length === 0 ? api.delete('/carrito') : api.put('/carrito', { items });
        peticion.catch(e => console.warn('No se pudo sincronizar el carrito:', e.message));
    }, 500);
}

export function guardarCarrito(carrito) {
    localStorage.setItem(CLAVE, JSON.stringify(carrito));
    empujarAlServidor(carrito);
}

/** Después de comprar: vacía el carrito local y el del servidor. */
export function vaciarCarrito() {
    localStorage.removeItem(CLAVE);
    clearTimeout(temporizador);
    if (esCliente()) api.delete('/carrito').catch(() => {});
}

/**
 * Se llama justo después de iniciar sesión como cliente:
 *  - si había productos en el navegador, se suben al servidor
 *  - si no había, se recupera el carrito que el cliente dejó guardado
 */
export async function sincronizarCarritoAlIniciarSesion() {
    if (!esCliente()) return;
    try {
        const local = leerCarrito();
        if (Object.keys(local).length > 0) {
            await api.put('/carrito', { items: Object.keys(local).map(id => ({ id, qty: local[id].qty })) });
            return;
        }
        const servidor = await api.get('/carrito');
        const obj = {};
        servidor.items.forEach(i => {
            obj[i.id] = {
                nombre: i.nombre, precio: i.precio, qty: i.cantidad, imagen: i.imagen,
                medida: i.medida, cantidadCaja: i.cantidadCaja, cantidadBolsa: i.cantidadBolsa,
                categoria: i.categoria, subcategoria: i.subcategoria
            };
        });
        localStorage.setItem(CLAVE, JSON.stringify(obj));
    } catch (e) {
        console.warn('No se pudo sincronizar el carrito:', e.message);
    }
}

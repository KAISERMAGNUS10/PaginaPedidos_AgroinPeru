// @ts-nocheck
// Migrado de js/app.js: sesión del header, contador del carrito, menú lateral y notificaciones.
// iniciarGlobalPublico() reemplaza al antiguo bloque DOMContentLoaded.
import { alLimpiar, irA, onGlobal } from './navegacion';
import { limpiarSesionSegura, obtenerSesionSegura } from './auth-storage';
import { api } from './api';
import { destinoPorRol } from './staff-nav';
import { leerCarrito } from './carrito-store';

// ==========================================
// 2. GESTIÓN DE SESIÓN Y MENÚ DESPLEGABLE (Global)
// ==========================================
export function obtenerSaludoUsuario() {
    const sesion = obtenerSesionSegura();
    if (!sesion || typeof sesion.Nombre !== 'string' || !sesion.Nombre.trim()) {
        return 'Hola';
    }

    const nombre = sesion.Nombre.trim().split(' ')[0];
    const apellido = typeof sesion.Apellidos === 'string' && sesion.Apellidos.trim()
        ? sesion.Apellidos.trim().split(' ')[0]
        : '';

    return apellido ? `Hola ${nombre} ${apellido}` : `Hola ${nombre}`;
}

export function inicializarSesion() {
    const sesion = obtenerSesionSegura();
    const userTrigger = document.getElementById('user-trigger');
    const userDisplayName = document.getElementById('user-display-name');
    const userGreetingLabel = userTrigger ? userTrigger.querySelector('.user-greeting-label') : null;
    const userDropdownMenu = document.getElementById('user-dropdown-menu');
    const dropdownUserFull = document.getElementById('dropdown-user-full');
    const btnLogoutTottus = document.getElementById('btn-logout-tottus');

    if (sesion) {
        const saludo = obtenerSaludoUsuario();

        if (userGreetingLabel) userGreetingLabel.textContent = '';
        if (userDisplayName) userDisplayName.textContent = `${saludo} ⌄`;
        if (dropdownUserFull) dropdownUserFull.textContent = saludo.replace('Hola ', '');

        if (userTrigger && userDropdownMenu) {
            userTrigger.addEventListener('click', (e) => {
                e.stopPropagation();
                userDropdownMenu.classList.toggle('active');
            });

            onGlobal(document, 'click', () => {
                if (userDropdownMenu.classList.contains('active')) {
                    userDropdownMenu.classList.remove('active');
                }
            });
        }

        // El personal (admin, caja, almacén) que entra a la tienda puede volver a su panel.
        if (sesion.Rol && sesion.Rol !== 'CLIENTE' && btnLogoutTottus && !document.getElementById('link-panel-staff')) {
            const enlace = document.createElement('a');
            enlace.id = 'link-panel-staff';
            enlace.className = btnLogoutTottus.className;
            enlace.href = destinoPorRol(sesion.Rol);
            enlace.textContent = 'Ir a mi panel';
            enlace.addEventListener('click', (e) => {
                e.preventDefault();
                irA(destinoPorRol(sesion.Rol));
            });
            btnLogoutTottus.parentNode.insertBefore(enlace, btnLogoutTottus);
        }

        if (btnLogoutTottus) {
            btnLogoutTottus.addEventListener('click', (e) => {
                e.preventDefault();
                limpiarSesionSegura();
                window.location.reload();
            });
        }
    } else {
        if (userDisplayName) userDisplayName.textContent = "Inicia sesión ⌄";
        if (userTrigger) {
            userTrigger.addEventListener('click', () => {
                irA('/login');
            });
        }
    }
}

// ==========================================
// 3. GESTIÓN DEL CARRITO Y REDIRECCIÓN A CARRITO.HTML
// ==========================================
export function actualizarContadorCarrito() {
    const cartCounter = document.getElementById('cart-counter');
    if (!cartCounter) return;

    let carritoLocal = leerCarrito();
    let totalItems = 0;
    
    if (carritoLocal && typeof carritoLocal === 'object') {
        for (let id in carritoLocal) {
            const item = carritoLocal[id];
            const qty = Number(item?.qty ?? item?.cantidad ?? 0);
            if (!isNaN(qty) && qty > 0) {
                totalItems += qty;
            }
        }
    }
    
    cartCounter.textContent = String(totalItems);

    // ACTIVA EL CLIC EN EL ÍCONO DEL CARRITO:
    // Busca el contenedor padre o enlace del ícono para redirigir a /carrito
    const cartContainer = cartCounter.closest('a') || cartCounter.parentElement;
    if (cartContainer) {
        cartContainer.style.cursor = 'pointer';
        cartContainer.onclick = (e) => {
            e.preventDefault();
            irA('/carrito');
        };
    }
}

// ==========================================
// 4. MENÚ LATERAL (☰) — compartido por todas las páginas
// ==========================================
export function inicializarMenuLateral() {
    const btnMainMenu = document.getElementById('btn-main-menu');
    const sideMenu = document.getElementById('side-menu');
    const menuOverlay = document.getElementById('menu-overlay');
    const btnCloseMenu = document.getElementById('btn-close-menu');

    const toggleMenu = () => {
        if (sideMenu && menuOverlay) {
            sideMenu.classList.toggle('active');
            menuOverlay.classList.toggle('active');
        }
    };

    if (btnMainMenu) btnMainMenu.addEventListener('click', toggleMenu);
    if (btnCloseMenu) btnCloseMenu.addEventListener('click', toggleMenu);
    if (menuOverlay) menuOverlay.addEventListener('click', toggleMenu);
}

// ==========================================
// 5. INICIALIZACIÓN
// ==========================================
export function updateHeaderGreeting() {
    const destino = document.getElementById('nombre-usuario-header');
    if (!destino) return;

    let saludo = 'Hola Invitado';
    const sesion = obtenerSesionSegura();

    if (sesion && typeof sesion.Nombre === 'string' && sesion.Nombre.trim()) {
        const primerNombre = sesion.Nombre.trim().split(' ')[0];
        const primerApellido = typeof sesion.Apellidos === 'string' && sesion.Apellidos.trim()
            ? sesion.Apellidos.trim().split(' ')[0]
            : '';
        saludo = primerApellido ? `Hola ${primerNombre} ${primerApellido}` : `Hola ${primerNombre}`;
    }

    destino.textContent = saludo;
}

// ==========================================
// 6. NOTIFICACIONES AL CLIENTE (ej. "pedido listo para recojo")
// ==========================================
export function inyectarEstilosNotificacion() {
    if (document.getElementById('agro-notif-styles')) return;
    const style = document.createElement('style');
    style.id = 'agro-notif-styles';
    style.textContent = `
        #agro-notif-container { position: fixed; top: 20px; right: 20px; z-index: 6000; display: flex; flex-direction: column; gap: 10px; max-width: 320px; }
        .agro-notif-toast { background: #0F4782; color: #fff; padding: 14px 18px; border-radius: 8px; font-size: 13.5px; line-height: 1.4; box-shadow: 0 4px 14px rgba(0,0,0,0.25); opacity: 0; transform: translateY(-10px); transition: opacity 0.25s ease, transform 0.25s ease; }
        .agro-notif-toast.mostrar { opacity: 1; transform: translateY(0); }
        .agro-notif-toast strong { display: block; margin-bottom: 3px; }
    `;
    document.head.appendChild(style);
}

export function mostrarNotificacionCliente(mensaje) {
    inyectarEstilosNotificacion();
    let contenedor = document.getElementById('agro-notif-container');
    if (!contenedor) {
        contenedor = document.createElement('div');
        contenedor.id = 'agro-notif-container';
        document.body.appendChild(contenedor);
    }

    const toast = document.createElement('div');
    toast.className = 'agro-notif-toast';
    toast.innerHTML = `<strong>📦 AGROINPERU</strong>${mensaje}`;
    contenedor.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('mostrar'));

    setTimeout(() => {
        toast.classList.remove('mostrar');
        setTimeout(() => toast.remove(), 300);
    }, 6000);
}

// Notificaciones del cliente: se descargan del backend (GET /api/notificaciones) y se guardan en memoria.
let notificacionesCache = [];

function esCliente() {
    const sesion = obtenerSesionSegura();
    return !!sesion && sesion.Rol === 'CLIENTE';
}

export async function cargarNotificaciones() {
    if (!esCliente()) {
        notificacionesCache = [];
        return;
    }
    try {
        notificacionesCache = await api.get('/notificaciones');
    } catch (e) {
        /* sin conexión: se conserva lo que había */
    }
}

// Muestra un toast puntual la primera vez que se ve cada notificación
// (independiente de si ya se "leyó" en la campana o no).
export async function mostrarNotificacionesPendientes() {
    const nuevas = notificacionesCache.filter(n => !n.mostradoToast);
    if (nuevas.length === 0) return;

    nuevas.forEach(n => {
        mostrarNotificacionCliente(n.mensaje);
        n.mostradoToast = true;
    });

    try {
        await api.patch('/notificaciones/toast-mostrado');
    } catch (e) { /* se reintenta en el siguiente ciclo */ }
}

// ==========================================
// 7. CAMPANA DE NOTIFICACIONES (persistente hasta que el cliente la revise)
// ==========================================
export function actualizarCampana() {
    const bell = document.getElementById('notif-bell');
    const dot = document.getElementById('notif-bell-dot');
    if (!bell || !dot) return;

    const noLeidas = notificacionesCache.filter(n => !n.leida);

    if (noLeidas.length > 0) {
        bell.classList.add('tiene-notif');
        dot.textContent = noLeidas.length > 9 ? '9+' : String(noLeidas.length);
        dot.style.display = 'block';
    } else {
        bell.classList.remove('tiene-notif');
        dot.textContent = '';
        dot.style.display = 'none';
    }
}

export function formatearFechaNotif(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('es-PE', {
        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
    });
}

export function renderizarDropdownNotif(dropdown, notificaciones) {
    if (notificaciones.length === 0) {
        dropdown.innerHTML = `<div class="notif-dropdown-vacio">No tienes notificaciones.</div>`;
        return;
    }

    dropdown.innerHTML = `
        <p class="notif-dropdown-titulo">Notificaciones</p>
        ${notificaciones.slice(0, 10).map(n => `
            <div class="notif-dropdown-item">
                ${n.mensaje}
                <span class="notif-dropdown-fecha">${formatearFechaNotif(n.fecha)}</span>
            </div>
        `).join('')}
    `;
}

export function inicializarCampana() {
    const bell = document.getElementById('notif-bell');
    const dropdown = document.getElementById('notif-dropdown');
    if (!bell || !dropdown) return;

    actualizarCampana();

    bell.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (!esCliente()) {
            dropdown.classList.toggle('active');
            renderizarDropdownNotif(dropdown, []);
            return;
        }

        const abriendo = !dropdown.classList.contains('active');
        dropdown.classList.toggle('active');

        if (abriendo) {
            await cargarNotificaciones();
            renderizarDropdownNotif(dropdown, notificacionesCache);

            // Al abrir la campana, el cliente ya se dio cuenta: se marcan como leídas
            if (notificacionesCache.some(n => !n.leida)) {
                notificacionesCache.forEach(n => { n.leida = true; });
                actualizarCampana();
                try { await api.patch('/notificaciones/leidas'); } catch (err) { /* reintento al abrir de nuevo */ }
            }
        }
    });

    onGlobal(document, 'click', () => {
        if (dropdown.classList.contains('active')) {
            dropdown.classList.remove('active');
        }
    });
}

async function refrescarNotificaciones() {
    await cargarNotificaciones();
    actualizarCampana();
    await mostrarNotificacionesPendientes();
}

export function iniciarGlobalPublico() {
    inicializarSesion();
    actualizarContadorCarrito();
    inicializarMenuLateral();
    updateHeaderGreeting();
    inicializarCampana();

    if (esCliente()) {
        refrescarNotificaciones();
        // Consulta cada 20 s para avisar apenas el pedido esté "listo para recojo".
        const temporizador = setInterval(refrescarNotificaciones, 20000);
        alLimpiar(() => clearInterval(temporizador));
    }
}

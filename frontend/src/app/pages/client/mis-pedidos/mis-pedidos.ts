// @ts-nocheck
// Migrado de mis-pedidos.html + mis-pedidos.js
import { Component, OnDestroy, ViewEncapsulation, afterNextRender } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ejecutarPagina, type Limpiador } from '../../../core/utils/navegacion';
import { alCargar, irA } from '../../../core/utils/navegacion';
import { guardarTicketActualId, obtenerEstadoTicketActualizado, obtenerSesionSegura } from '../../../core/utils/auth-storage';
import { api } from '../../../core/utils/api';
import { AgroUI } from '../../../core/utils/agro-ui';
import { conAviso } from '../../../core/utils/precarga';

// Pedidos del cliente, descargados del backend antes de pintar la pantalla.
let ticketsCache = [];
async function cargarMisPedidos() {
  ticketsCache = obtenerSesionSegura() ? await api.get('/pedidos/mis-pedidos') : [];
}
import { AgroUI } from '../../../core/utils/agro-ui';
import { iniciarGlobalPublico } from '../../../core/utils/layout-global';

@Component({
  selector: 'app-mis-pedidos',
  imports: [RouterLink],
  templateUrl: './mis-pedidos.html',
  styleUrls: ['../../../../styles/header.css', './mis-pedidos.css', '../../../../styles/ui-enhancements.css'],
  // Se conserva el CSS original tal cual: sin encapsulación y respetando los espacios del HTML viejo.
  encapsulation: ViewEncapsulation.None,
  preserveWhitespaces: true,
  host: { style: 'display: contents' }
})
export class MisPedidos implements OnDestroy {
  private limpiar: Limpiador | null = null;

  constructor() {
    // El JS original necesita que el HTML ya esté en el DOM, por eso corre después del primer render (solo navegador).
    afterNextRender(() => {
      conAviso(cargarMisPedidos()).then(() => {
      this.limpiar = ejecutarPagina(() => {
        iniciarGlobalPublico();
        iniciarMisPedidos();
      });
      });
    });
  }

  ngOnDestroy(): void {
    this.limpiar?.();
  }
}

// ==========================================================================
// LÓGICA ORIGINAL (copiada tal cual del proyecto viejo)
// ==========================================================================
function iniciarMisPedidos() {
function normalizar(valor) {
    return (valor || '').toString().trim().toLowerCase();
}

function obtenerUsuarioActivo() {
    const sesion = obtenerSesionSegura();

    if (sesion && (sesion.Correo || sesion.Nombre)) {
        return {
            correo: normalizar(sesion.Correo),
            clienteNombre: normalizar(`${sesion.Nombre || ''} ${sesion.Apellidos || ''}`)
        };
    }

    return null;
}

function leerTickets() {
    return ticketsCache;
}

function buscarIndicePorId(db, id) {
    return db.findIndex(t => t.id === id);
}

const usuarioActivo = obtenerUsuarioActivo();

function perteneceAlUsuario(ticket) {
    // El backend solo entrega los pedidos del cliente con sesión iniciada.
    return Boolean(usuarioActivo);
    if (!usuarioActivo) return false;
    const correoTicket = normalizar(ticket.correo);
    const clienteTicket = normalizar(ticket.cliente);
    const coincideCorreo = usuarioActivo.correo && correoTicket && correoTicket === usuarioActivo.correo;
    const coincideCliente = usuarioActivo.clienteNombre && clienteTicket && clienteTicket === usuarioActivo.clienteNombre;
    return Boolean(coincideCorreo || coincideCliente);
}

function leerTicketsDelUsuario() {
    return leerTickets().filter(perteneceAlUsuario);
}

function obtenerTicketPropioPorId(id) {
    const ticket = leerTickets().find(t => t.id === id);
    if (!ticket || !perteneceAlUsuario(ticket)) return null;
    return ticket;
}

const ESTADOS_FINALES = ['ENTREGADO', 'CANCELADO'];

function calcularEstadoMostrado(ticket) {
    return typeof obtenerEstadoTicketActualizado === 'function'
        ? obtenerEstadoTicketActualizado(ticket)
        : (ticket.estado || 'VIGENTE');
}

function etiquetaEstado(estadoMostrado) {
    const etiquetas = {
        VIGENTE: 'VIGENTE',
        PAGADO: 'PAGADO',
        LISTO_PARA_RECOJO: 'LISTO PARA RECOJO',
        ENTREGADO: 'ENTREGADO',
        CANCELADO: 'CANCELADO',
        EXPIRADO: 'EXPIRADO'
    };
    return etiquetas[estadoMostrado] || estadoMostrado;
}

function puedeCancelar(ticket) {
    if (calcularEstadoMostrado(ticket) !== 'VIGENTE') return false;
    const horasTranscurridas = (Date.now() - new Date(ticket.fechaEmision).getTime()) / 3600000;
    return horasTranscurridas < 24;
}

function puedeGestionarPersonaAutorizada(ticket) {
    const estado = calcularEstadoMostrado(ticket);
    return !['ENTREGADO', 'CANCELADO', 'EXPIRADO'].includes(estado);
}

function formatearFecha(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('es-PE', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
}

const estadoSinSesion = document.getElementById('estado-sin-sesion');
const estadoSinPedidos = document.getElementById('estado-sin-pedidos');
const contenedorLista = document.getElementById('lista-pedidos');

function renderizarPedidos() {
    estadoSinSesion.style.display = 'none';
    estadoSinPedidos.style.display = 'none';
    contenedorLista.style.display = 'none';

    if (!usuarioActivo) {
        estadoSinSesion.style.display = 'block';
        return;
    }

    const pedidos = leerTicketsDelUsuario();

    if (pedidos.length === 0) {
        estadoSinPedidos.style.display = 'block';
        return;
    }

    contenedorLista.style.display = 'flex';
    const pedidosOrdenados = [...pedidos]; // el backend ya los entrega del más reciente al más antiguo

    contenedorLista.innerHTML = pedidosOrdenados.map(ticket => {
        const estadoMostrado = calcularEstadoMostrado(ticket);
        const persona = ticket.personaAutorizada;

        return `
        <div class="pedido-card" data-ticket-id="${ticket.id}">
            <div class="pedido-card-top">
                <div>
                    <div class="pedido-id">${ticket.id}</div>
                    <div class="pedido-fecha">Emitido: ${formatearFecha(ticket.fechaEmision)}</div>
                </div>
                <div>
                    <span class="estado-badge estado-${estadoMostrado}">${etiquetaEstado(estadoMostrado)}</span>
                    <div class="pedido-total">S/ ${parseFloat(ticket.total || 0).toFixed(2)}</div>
                </div>
            </div>

            ${persona ? `
                <div class="pedido-persona-autorizada">
                    🧾 Autorizado para recoger: <strong>${persona.nombre}</strong> — DNI ${persona.dni}
                </div>` : ''}

            <div class="pedido-actions">
                <button class="btn-pedido btn-pedido-primary" data-action="ver" data-id="${ticket.id}">Ver detalle / Ticket</button>

                ${puedeCancelar(ticket) ? `
                    <button class="btn-pedido btn-pedido-danger" data-action="cancelar" data-id="${ticket.id}">Cancelar Pedido</button>
                ` : ''}

                ${puedeGestionarPersonaAutorizada(ticket) ? `
                    <button class="btn-pedido btn-pedido-secondary" data-action="persona" data-id="${ticket.id}">
                        ${persona ? 'Editar persona autorizada' : 'Asignar Persona Autorizada para Recojo'}
                    </button>
                ` : ''}
            </div>
        </div>`;
    }).join('');
}

function verDetalle(id) {
    const ticket = obtenerTicketPropioPorId(id);
    if (!ticket) return;

    guardarTicketActualId(ticket.id);
    irA('/ticket');
}

async function cancelarPedido(id) {
    const ticketPropio = obtenerTicketPropioPorId(id);
    if (!ticketPropio) return;

    const confirmado = confirm('¿Seguro que deseas cancelar este pedido? Esta acción no se puede deshacer.');
    if (!confirmado) return;

    try {
        const actualizado = await api.patch(`/pedidos/${encodeURIComponent(id)}/cancelar`);
        reemplazarEnCache(actualizado);
        renderizarPedidos();
        AgroUI.toast('El pedido fue cancelado correctamente.', 'success');
    } catch (err) {
        AgroUI.toast(err.message, 'error', 'No se pudo cancelar');
        await recargarYPintar();
    }
}

function reemplazarEnCache(ticket) {
    const idx = ticketsCache.findIndex(t => t.id === ticket.id);
    if (idx >= 0) ticketsCache[idx] = ticket;
}

async function recargarYPintar() {
    try { await cargarMisPedidos(); } catch (e) { /* se mantiene lo que había */ }
    renderizarPedidos();
}

const modalOverlay = document.getElementById('modal-overlay');
const modalNombre = document.getElementById('modal-nombre');
const modalDni = document.getElementById('modal-dni');
const modalErrNombre = document.getElementById('modal-err-nombre');
const modalErrDni = document.getElementById('modal-err-dni');
const modalBtnGuardar = document.getElementById('modal-btn-guardar');
const modalBtnCancelar = document.getElementById('modal-btn-cancelar');
const modalBtnQuitar = document.getElementById('modal-btn-quitar');

let idTicketEnEdicion = null;

function abrirModalPersona(id) {
    const ticket = obtenerTicketPropioPorId(id);
    if (!ticket) return;

    idTicketEnEdicion = id;
    modalErrNombre.textContent = '';
    modalErrDni.textContent = '';

    const persona = ticket.personaAutorizada;
    modalNombre.value = persona ? persona.nombre : '';
    modalDni.value = persona ? persona.dni : '';
    modalBtnQuitar.style.display = persona ? 'inline-block' : 'none';

    modalOverlay.classList.add('active');
    modalNombre.focus();
}

function cerrarModalPersona() {
    modalOverlay.classList.remove('active');
    idTicketEnEdicion = null;
}

async function guardarPersonaAutorizada() {
    const ticketPropio = obtenerTicketPropioPorId(idTicketEnEdicion);
    if (!ticketPropio) return;

    const nombre = modalNombre.value.trim();
    const dni = modalDni.value.trim();

    modalErrNombre.textContent = '';
    modalErrDni.textContent = '';

    let valido = true;
    if (nombre.length < 3) {
        modalErrNombre.textContent = 'Ingresa nombres y apellidos completos.';
        valido = false;
    }
    if (!/^\d{8}$/.test(dni)) {
        modalErrDni.textContent = 'El DNI debe tener exactamente 8 dígitos.';
        valido = false;
    }
    if (!valido) return;

    try {
        const actualizado = await api.put(`/pedidos/${encodeURIComponent(idTicketEnEdicion)}/persona-autorizada`, { nombre, dni });
        reemplazarEnCache(actualizado);
        cerrarModalPersona();
        renderizarPedidos();
        AgroUI.toast('Persona autorizada guardada.', 'success');
    } catch (err) {
        AgroUI.toast(err.message, 'error', 'No se pudo guardar');
    }
}

async function quitarPersonaAutorizada() {
    const ticketPropio = obtenerTicketPropioPorId(idTicketEnEdicion);
    if (!ticketPropio) return;

    try {
        const actualizado = await api.delete(`/pedidos/${encodeURIComponent(idTicketEnEdicion)}/persona-autorizada`);
        reemplazarEnCache(actualizado);
        cerrarModalPersona();
        renderizarPedidos();
    } catch (err) {
        AgroUI.toast(err.message, 'error', 'No se pudo quitar');
    }
}

modalBtnGuardar.addEventListener('click', guardarPersonaAutorizada);
modalBtnCancelar.addEventListener('click', cerrarModalPersona);
modalBtnQuitar.addEventListener('click', quitarPersonaAutorizada);
modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) cerrarModalPersona();
});

contenedorLista.addEventListener('click', (e) => {
    const boton = e.target.closest('button[data-action]');
    if (!boton) return;

    const id = boton.getAttribute('data-id');
    const accion = boton.getAttribute('data-action');

    if (accion === 'ver') verDetalle(id);
    if (accion === 'cancelar') cancelarPedido(id);
    if (accion === 'persona') abrirModalPersona(id);
});

alCargar(renderizarPedidos);

}

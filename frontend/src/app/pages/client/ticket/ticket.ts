// @ts-nocheck
// Migrado de ticket.html + ticket.js
import { Component, OnDestroy, ViewEncapsulation, afterNextRender } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ejecutarPagina, type Limpiador } from '../../../core/utils/navegacion';
import { alCargar } from '../../../core/utils/navegacion';
import { obtenerEstadoTicketActualizado, obtenerTicketActualId } from '../../../core/utils/auth-storage';
import { api } from '../../../core/utils/api';
import { conAviso } from '../../../core/utils/precarga';

// Ticket descargado del backend (por ?id= o por el último pedido generado).
let ticketCargado = null;
async function cargarTicketDelServidor() {
  ticketCargado = null;
  const id = new URLSearchParams(window.location.search).get('id') || obtenerTicketActualId();
  if (id) ticketCargado = await api.get(`/pedidos/${encodeURIComponent(id)}`);
}
import { iniciarGlobalPublico } from '../../../core/utils/layout-global';

@Component({
  selector: 'app-ticket',
  imports: [RouterLink],
  templateUrl: './ticket.html',
  styleUrls: ['../../../../styles/header.css', './ticket.css', '../../../../styles/ui-enhancements.css'],
  // Se conserva el CSS original tal cual: sin encapsulación y respetando los espacios del HTML viejo.
  encapsulation: ViewEncapsulation.None,
  preserveWhitespaces: true,
  host: { style: 'display: contents' }
})
export class Ticket implements OnDestroy {
  private limpiar: Limpiador | null = null;

  constructor() {
    // El JS original necesita que el HTML ya esté en el DOM, por eso corre después del primer render (solo navegador).
    afterNextRender(() => {
      conAviso(cargarTicketDelServidor()).then(() => {
      this.limpiar = ejecutarPagina(() => {
        iniciarGlobalPublico();
        iniciarTicket();
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
function iniciarTicket() {
// ==========================================
// TICKET.JS — Lectura, render y acciones del ticket de pago
// ==========================================

function formatearFecha(iso) {
    const fecha = new Date(iso);
    return fecha.toLocaleString('es-PE', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

// Lee el ticket completo guardado por checkout.js (objeto plano, no requiere búsqueda)
function cargarTicket() {
    return ticketCargado;
}

function renderizarTicket(ticket) {
    // Cada campo tiene un valor de respaldo ("—" o array vacío) para que,
    // si algo viene incompleto, el resto de la tarjeta se siga pintando igual.
    document.getElementById('t-id').textContent = ticket.id || '—';
    document.getElementById('t-emision').textContent = ticket.fechaEmision ? formatearFecha(ticket.fechaEmision) : '—';
    document.getElementById('t-expira').textContent = ticket.fechaExpiracion
        ? `${formatearFecha(ticket.fechaExpiracion)} (Vence en 2 días)`
        : '—';
    document.getElementById('t-cliente').textContent = ticket.nombreFacturacion || ticket.cliente || '—';
    document.getElementById('t-doc-label').textContent = ticket.documentoTipo || 'DNI / RUC';
    document.getElementById('t-doc').textContent = ticket.documentoNumero || '—';
    document.getElementById('t-email').textContent = ticket.correo || '—';

    // RF28/RF33: persona autorizada para el recojo (asignada desde Mis Pedidos)
    const persona = ticket.personaAutorizada;
    document.getElementById('t-autorizado-nombre').textContent = persona ? persona.nombre : 'Titular de la compra';
    document.getElementById('t-autorizado-dni').textContent = persona ? persona.dni : '—';

    // Tabla de productos
    const productos = Array.isArray(ticket.productos) ? ticket.productos : [];
    const tbody = document.getElementById('t-items');

    if (productos.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="ticket-table-empty">Sin productos</td></tr>`;
    } else {
        tbody.innerHTML = productos.map(item => {
            const nombre = item.nombre || item.name || 'Producto Agro';
            const precio = parseFloat(item.precio || item.price || 0) || 0;
            const cantidad = parseInt(item.cantidad || item.qty || 1) || 1;
            return `
                <tr>
                    <td>${nombre}</td>
                    <td>${cantidad}</td>
                    <td>S/ ${precio.toFixed(2)}</td>
                    <td>S/ ${(precio * cantidad).toFixed(2)}</td>
                </tr>`;
        }).join('');
    }

    const total = parseFloat(ticket.total || 0) || 0;
    document.getElementById('t-total').textContent = `S/ ${total.toFixed(2)}`;

    // QR — se codifica únicamente el ID del ticket
    const qrImg = document.getElementById('t-qr');
    if (ticket.id) {
        qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(ticket.id)}`;
    }

    // Estado del badge: primero respeta ticket.estado (por ej. CANCELADO,
    // puesto desde Mis Pedidos); si sigue VIGENTE, recién ahí se compara
    // contra la fecha de expiración para mostrar EXPIRADO si corresponde.
    const badge = document.getElementById('ticket-status-badge');
    const estadoMostrado = typeof obtenerEstadoTicketActualizado === 'function'
        ? obtenerEstadoTicketActualizado(ticket)
        : (ticket.estado || 'VIGENTE');

    const etiquetas = {
        VIGENTE: 'VIGENTE',
        CANCELADO: 'CANCELADO',
        PAGADO: 'PAGADO',
        LISTO_PARA_RECOJO: 'LISTO PARA RECOJO',
        ENTREGADO: 'ENTREGADO',
        EXPIRADO: 'EXPIRADO'
    };

    badge.textContent = etiquetas[estadoMostrado] || estadoMostrado;
    badge.className = 'ticket-status-badge badge-' + estadoMostrado.toLowerCase().replace(/_/g, '-');
}

function descargarTicket(ticket) {
    const html = document.getElementById('ticket-card').outerHTML;
    const documentoCompleto = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
        <title>Ticket ${ticket.id}</title>
        <link rel="stylesheet" href="css/header.css">
        <link rel="stylesheet" href="css/ticket.css"></head>
        <body style="background:#f4f4f4; padding:20px;">${html}</body></html>`;

    const blob = new Blob([documentoCompleto], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${ticket.id || 'ticket'}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

alCargar(() => {
    const ticket = cargarTicket();

    if (!ticket) {
        document.getElementById('ticket-card').style.display = 'none';
        document.getElementById('ticket-empty-state').style.display = 'block';
        return;
    }

    renderizarTicket(ticket);

    document.getElementById('btn-imprimir').addEventListener('click', () => window.print());
    document.getElementById('btn-descargar').addEventListener('click', () => descargarTicket(ticket));
});

}

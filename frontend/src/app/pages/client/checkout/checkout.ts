// @ts-nocheck
// Migrado de checkout.html + checkout.js
import { Component, OnDestroy, ViewEncapsulation, afterNextRender } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ejecutarPagina, type Limpiador } from '../../../core/utils/navegacion';
import { alCargar, irA } from '../../../core/utils/navegacion';
import { guardarTicketActualId, obtenerSesionSegura } from '../../../core/utils/auth-storage';
import { api } from '../../../core/utils/api';
import { AgroUI } from '../../../core/utils/agro-ui';
import { leerCarrito as leerCarritoStore, vaciarCarrito } from '../../../core/utils/carrito-store';
import { cargarCatalogo, obtenerProductoCatalogo } from '../../../core/data/catalogo-data';
import { conAviso } from '../../../core/utils/precarga';
import { iniciarGlobalPublico } from '../../../core/utils/layout-global';

@Component({
  selector: 'app-checkout',
  imports: [RouterLink],
  templateUrl: './checkout.html',
  styleUrls: ['../../../../styles/header.css', './checkout.css', '../../../../styles/ui-enhancements.css'],
  // Se conserva el CSS original tal cual: sin encapsulación y respetando los espacios del HTML viejo.
  encapsulation: ViewEncapsulation.None,
  preserveWhitespaces: true,
  host: { style: 'display: contents' }
})
export class Checkout implements OnDestroy {
  private limpiar: Limpiador | null = null;

  constructor() {
    // El JS original necesita que el HTML ya esté en el DOM, por eso corre después del primer render (solo navegador).
    afterNextRender(() => {
      conAviso(cargarCatalogo()).then(() => {
      this.limpiar = ejecutarPagina(() => {
        iniciarGlobalPublico();
        iniciarCheckout();
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
function iniciarCheckout() {
// ==========================================
// CHECKOUT.JS — Formulario de facturación + generación de ticket
// ==========================================

// --- 0. Seguridad de entrada a la página ---
// (se relee localStorage en cada función, nunca se guarda en una
// variable "congelada" que pueda quedar desactualizada)
function leerCarrito() {
    return leerCarritoStore();
}

const sesionActiva = obtenerSesionSegura({ redirigirSiInvalida: true });

if (Object.keys(leerCarrito()).length === 0) {
    irA('/carrito');
}

// ==========================================
// 1. VALIDADORES
// ==========================================
const Validadores = {
    minLength: (valor, min) => valor.trim().length >= min,
    dni: (valor) => /^\d{8}$/.test(valor.trim()),
    ce: (valor) => /^[a-zA-Z0-9]{6,12}$/.test(valor.trim()),
    ruc: (valor) => /^(10|15|17|20)\d{9}$/.test(valor.trim()),
    email: (valor) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor.trim()),
    telefono: (valor) => /^9\d{8}$/.test(valor.trim())
};

// ==========================================
// 2. REFERENCIAS AL DOM
// ==========================================
const form = document.getElementById('form-checkout');
const btnConfirmar = document.getElementById('btn-confirmar');

const optBoleta = document.getElementById('opt-boleta');
const optFactura = document.getElementById('opt-factura');

const lblNombreRazon = document.getElementById('lbl-nombre-razon');
const inputNombreRazon = document.getElementById('chk-nombre-razon');
const inputEmail = document.getElementById('chk-email');

const tipoDoc = document.getElementById('chk-tipo-doc');
const lblNumDoc = document.getElementById('lbl-num-doc');
const numDoc = document.getElementById('chk-num-doc');

// ==========================================
// 3. SELECTOR DE DOCUMENTO DINÁMICO (Boleta ⇄ Factura)
// ==========================================
function actualizarCamposSegunComprobante() {
    const esBoleta = optBoleta.checked;

    if (esBoleta) {
        lblNombreRazon.textContent = 'Nombres y Apellidos completos';
        inputNombreRazon.placeholder = 'Ej. Juan Pérez Ramírez';
        tipoDoc.innerHTML = `
            <option value="dni">DNI</option>
            <option value="ce">Pasaporte / Carné de Extranjería</option>
        `;
    } else {
        lblNombreRazon.textContent = 'Razón Social';
        inputNombreRazon.placeholder = 'Ej. Distribuidora Agro E.I.R.L.';
        tipoDoc.innerHTML = `
            <option value="ruc">RUC (para empresas y pedidos al por mayor)</option>
        `;
    }

    actualizarCamposSegunTipoDoc();
    validarFormularioCompleto();
}

function actualizarCamposSegunTipoDoc() {
    const tipo = tipoDoc.value;
    if (tipo === 'dni') {
        lblNumDoc.textContent = 'N° de DNI';
        numDoc.placeholder = '8 dígitos';
        numDoc.maxLength = 8;
    } else if (tipo === 'ce') {
        lblNumDoc.textContent = 'N° de Pasaporte / CE';
        numDoc.placeholder = '6 a 12 caracteres';
        numDoc.maxLength = 12;
    } else if (tipo === 'ruc') {
        lblNumDoc.textContent = 'N° de RUC';
        numDoc.placeholder = '11 dígitos';
        numDoc.maxLength = 11;
    }
    numDoc.value = ''; // evita dejar un valor con formato del tipo anterior
    validarFormularioCompleto();
}

optBoleta.addEventListener('change', actualizarCamposSegunComprobante);
optFactura.addEventListener('change', actualizarCamposSegunComprobante);
tipoDoc.addEventListener('change', actualizarCamposSegunTipoDoc);

// ==========================================
// 4. VALIDACIÓN EN TIEMPO REAL
// ==========================================
function construirCampos() {
    const esBoleta = optBoleta.checked;
    const tipo = tipoDoc.value;

    const validarNumDoc = (v) => {
        if (tipo === 'dni') return Validadores.dni(v);
        if (tipo === 'ce') return Validadores.ce(v);
        if (tipo === 'ruc') return Validadores.ruc(v);
        return false;
    };
    const errorNumDoc = () => {
        if (tipo === 'dni') return 'El DNI debe tener exactamente 8 dígitos.';
        if (tipo === 'ce') return 'Documento inválido (6 a 12 caracteres).';
        if (tipo === 'ruc') return 'El RUC debe tener 11 dígitos y empezar con 10, 15, 17 o 20.';
        return 'Documento inválido.';
    };

    return {
        'chk-nombre-razon': {
            validar: (v) => Validadores.minLength(v, 3),
            error: esBoleta ? 'Ingresa nombres y apellidos completos.' : 'Ingresa la razón social.'
        },
        'chk-num-doc': {
            validar: validarNumDoc,
            error: errorNumDoc()
        },
        'chk-email': {
            validar: (v) => Validadores.email(v),
            error: 'Ingresa un correo electrónico válido.'
        },
        'chk-telefono': {
            validar: (v) => Validadores.telefono(v),
            error: 'El teléfono debe tener 9 dígitos y empezar con 9.'
        }
    };
}

function validarCampo(id, definicion) {
    const input = document.getElementById(id);
    const errorSpan = document.getElementById('err-' + id.replace('chk-', ''));
    if (!input) return true;

    const valido = definicion.validar(input.value);
    if (errorSpan) errorSpan.textContent = valido ? '' : definicion.error;
    input.classList.toggle('input-invalid', !valido && input.value.trim().length > 0);
    return valido;
}

function validarFormularioCompleto() {
    const campos = construirCampos();
    let todoValido = true;

    Object.entries(campos).forEach(([id, definicion]) => {
        if (!validarCampo(id, definicion)) todoValido = false;
    });

    // El total debe ser mayor a 0 (carrito con productos reales) para poder confirmar
    const total = calcularTotal(obtenerItemsCarrito());
    if (total <= 0) todoValido = false;

    btnConfirmar.disabled = !todoValido;
    return todoValido;
}

['chk-nombre-razon', 'chk-num-doc', 'chk-email', 'chk-telefono'].forEach(id => {
    const input = document.getElementById(id);
    if (input) input.addEventListener('input', validarFormularioCompleto);
});

// ==========================================
// 5. RESUMEN DEL PEDIDO (lee el carrito SIEMPRE fresco)
// ==========================================
function obtenerItemsCarrito() {
    const carritoLocal = leerCarrito();
    return Object.entries(carritoLocal).reduce((items, [id, item]) => {
        const productoReal = typeof obtenerProductoCatalogo === 'function' ? obtenerProductoCatalogo(id) : null;
        if (!productoReal) return items;

        const cantidad = parseInt(item.cantidad || item.qty || 1) || 1;
        items.push({
            id: productoReal.id,
            nombre: productoReal.nombreCompleto,
            precio: productoReal.precio,
            cantidad: cantidad,
            medida: productoReal.medida,
            cantidadCaja: productoReal.cantidadCaja,
            cantidadBolsa: productoReal.cantidadBolsa,
            categoria: productoReal.categoria,
            subcategoria: productoReal.subcategoria
        });
        return items;
    }, []);
}

function calcularTotal(items) {
    return items.reduce((acc, item) => acc + (item.precio * item.cantidad), 0);
}

function renderizarResumenCheckout() {
    const items = obtenerItemsCarrito();
    const itemsList = document.getElementById('checkout-items-list');
    const totalEl = document.getElementById('checkout-total');

    if (items.length === 0) {
        itemsList.innerHTML = `<p style="color:#888; font-size:13px;">Tu carrito está vacío.</p>`;
        totalEl.textContent = 'S/ 0.00';
        return;
    }

    itemsList.innerHTML = items.map(item => `
        <div class="summary-row">
            <span>${item.nombre} × ${item.cantidad}</span>
            <span>S/ ${(item.precio * item.cantidad).toFixed(2)}</span>
        </div>
    `).join('');

    totalEl.textContent = `S/ ${calcularTotal(items).toFixed(2)}`;
}

// ==========================================
// 6. GENERACIÓN Y PERSISTENCIA DEL TICKET
// ==========================================
function normalizar(valor) {
    return (valor || '').toString().trim().toLowerCase();
}

function obtenerUsuarioActivo() {
    if (sesionActiva && (sesionActiva.Correo || sesionActiva.Nombre)) {
        return {
            correo: (sesionActiva.Correo || '').trim(),
            cliente: `${sesionActiva.Nombre || ''} ${sesionActiva.Apellidos || ''}`.trim()
        };
    }

    return null;
}

function recolectarDatosCliente() {
    const esBoleta = optBoleta.checked;
    const tipo = tipoDoc.value;
    const etiquetasDoc = { dni: 'DNI', ce: 'CE/Pasaporte', ruc: 'RUC' };

    return {
        tipoComprobante: esBoleta ? 'boleta' : 'factura',
        cliente: document.getElementById('chk-nombre-razon').value.trim(),
        documentoTipo: etiquetasDoc[tipo] || tipo.toUpperCase(),
        documentoNumero: document.getElementById('chk-num-doc').value.trim(),
        correo: document.getElementById('chk-email').value.trim(),
        telefono: document.getElementById('chk-telefono').value.trim()
    };
}

// ==========================================
// 7. ENVÍO DEL FORMULARIO
// ==========================================
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validarFormularioCompleto()) return;

    const datos = recolectarDatosCliente();
    const carrito = leerCarrito();
    const items = Object.keys(carrito).map(id => ({
        id,
        cantidad: carrito[id].qty !== undefined ? carrito[id].qty : carrito[id].cantidad
    }));

    const textoOriginal = btnConfirmar.textContent;
    btnConfirmar.disabled = true;
    btnConfirmar.textContent = 'Generando ticket...';

    try {
        // El backend valida stock y precios, reserva el stock y genera el ticket (48 h de vigencia).
        const ticket = await api.post('/pedidos', {
            tipoComprobante: datos.tipoComprobante,
            nombreFacturacion: datos.cliente,
            documentoTipo: datos.documentoTipo,
            documentoNumero: datos.documentoNumero,
            correo: datos.correo,
            telefono: datos.telefono,
            items
        });

        guardarTicketActualId(ticket.id);
        vaciarCarrito();
        irA('/ticket');
    } catch (err) {
        AgroUI.toast(err.message, 'error', 'No se pudo generar el pedido');
        btnConfirmar.disabled = false;
        btnConfirmar.textContent = textoOriginal;
    }
});

// ==========================================
// 8. INICIALIZACIÓN
// ==========================================
function precargarDatosSesion() {
    const usuarioActivo = obtenerUsuarioActivo();
    if (!usuarioActivo) return;

    if (usuarioActivo.cliente) {
        inputNombreRazon.value = usuarioActivo.cliente;
    }

    if (usuarioActivo.correo) {
        inputEmail.value = usuarioActivo.correo;
        inputEmail.readOnly = true;
        inputEmail.classList.add('campo-bloqueado');
    }

    validarFormularioCompleto();
}

alCargar(() => {
    renderizarResumenCheckout();
    actualizarCamposSegunComprobante();
    precargarDatosSesion();
});

}

// @ts-nocheck
// Migrado de producto.html + producto.js
import { Component, OnDestroy, ViewEncapsulation, afterNextRender } from '@angular/core';
import { TiendaHeader } from '../../../shared/tienda-header';
import { ejecutarPagina, type Limpiador } from '../../../core/utils/navegacion';
import { alCargar, irA } from '../../../core/utils/navegacion';
import { cargarProducto } from '../../../core/data/catalogo-data';
import { fijarCantidadCarrito, guardarCarrito, leerCantidadEscrita, leerCarrito } from '../../../core/utils/carrito-store';
import { AgroUI } from '../../../core/utils/agro-ui';
import { conAviso } from '../../../core/utils/precarga';
import { actualizarContadorCarrito } from '../../../core/utils/layout-global';
import { iniciarGlobalPublico } from '../../../core/utils/layout-global';

@Component({
  selector: 'app-producto',
  imports: [TiendaHeader],
  templateUrl: './producto.html',
  styleUrls: ['./producto.css', '../../../../styles/header.css', '../../../../styles/tienda.css', '../../../../styles/ui-enhancements.css'],
  // Se conserva el CSS original tal cual: sin encapsulación y respetando los espacios del HTML viejo.
  encapsulation: ViewEncapsulation.None,
  preserveWhitespaces: true,
  host: { style: 'display: contents' }
})
export class Producto implements OnDestroy {
  private limpiar: Limpiador | null = null;

  constructor() {
    // El JS original necesita que el HTML ya esté en el DOM, por eso corre después del primer render (solo navegador).
    afterNextRender(() => {
      // Solo se pide este producto (no el catálogo completo).
      const sku = new URLSearchParams(window.location.search).get('id') || '';
      conAviso(sku ? cargarProducto(sku) : Promise.reject(new Error('Producto no indicado.'))).then(producto => {
      this.limpiar = ejecutarPagina(() => {
        iniciarProducto(producto || null);
        iniciarGlobalPublico();
      });
      });
    });
  }

  ngOnDestroy(): void {
    this.limpiar?.();
  }
}

// ==========================================================================
// LÓGICA DE LA PÁGINA
// ==========================================================================
const ICONO_PAPELERA = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18 M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6 M10 11v6 M14 11v6 M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>';

function iniciarProducto(productoActual) {

let carritoProducto = leerCarrito();

if (!productoActual) {
    irA('/');
    return;
}

function pintarDetalleProducto() {
    document.title = `${productoActual.nombreCompleto} · AGROINPERU`;
    document.getElementById('detalle-nombre').textContent = productoActual.nombre;
    document.getElementById('detalle-medida').textContent = `Medida: ${productoActual.medida}`;
    document.getElementById('detalle-precio').textContent = `S/ ${productoActual.precio.toFixed(2)}`;
    document.getElementById('detalle-categoria').textContent = `${productoActual.categoria} · ${productoActual.subcategoria}`;
    document.getElementById('detalle-caja').textContent = productoActual.cantidadCaja === null || productoActual.cantidadCaja === undefined ? 'No especificado' : `${productoActual.cantidadCaja} unidades`;
    document.getElementById('detalle-bolsa').textContent = productoActual.cantidadBolsa === null || productoActual.cantidadBolsa === undefined ? 'No aplica' : `${productoActual.cantidadBolsa} unidades`;
    document.getElementById('detalle-descripcion').textContent = productoActual.descripcion;

    const imagen = document.getElementById('detalle-img');
    imagen.src = productoActual.imagen;
    imagen.alt = productoActual.nombreCompleto;
    imagen.onerror = () => {
        imagen.onerror = null;
        imagen.src = 'img/logoagroperu.jpg';
    };

    const telefonoEmpresa = '51934757123';
    const correoEmpresa = 'agrointegraldelperu@gmail.com';
    const mensajeWa = encodeURIComponent(`Hola Agro Integral del Perú, deseo cotizar ${productoActual.nombre}, medida ${productoActual.medida}. ¿Me apoyan con stock y precio actualizado?`);
    const asuntoCorreo = encodeURIComponent(`Consulta de catálogo web: ${productoActual.nombreCompleto}`);
    const cuerpoCorreo = encodeURIComponent(`Hola,\n\nEstoy interesado en adquirir el producto "${productoActual.nombreCompleto}".\nPor favor, confirmen disponibilidad y condiciones de venta.\n\nGracias.`);

    document.getElementById('link-whatsapp').href = `https://wa.me/${telefonoEmpresa}?text=${mensajeWa}`;
    document.getElementById('link-email').href = `mailto:${correoEmpresa}?subject=${asuntoCorreo}&body=${cuerpoCorreo}`;
}

function renderizarCarritoDetalle() {
        const btnInitial = document.getElementById('detalle-agregar');
    const qtyControl = document.getElementById('qty-control-main');
        const qtyVal = document.getElementById('qty-input-main');
    const btnMenos = document.getElementById('btn-menos');
    const item = carritoProducto[productoActual.id];

    if (item && item.qty > 0) {
        btnInitial.style.display = 'none';
        qtyControl.style.display = 'flex';
                if (document.activeElement !== qtyVal) qtyVal.value = String(item.qty);

        const unidad = item.qty === 1;
        btnMenos.classList.toggle('trash', unidad);
        btnMenos.innerHTML = unidad ? ICONO_PAPELERA : '−';
        btnMenos.setAttribute('aria-label', unidad ? 'Quitar del carrito' : 'Quitar uno');
    } else {
        btnInitial.style.display = 'flex';
        qtyControl.style.display = 'none';
    }

    if (typeof actualizarContadorCarrito === 'function') actualizarContadorCarrito();
}

/** Avisa si se pide más de lo que hay en stock. */
function superaStock(cantidad) {
    const stock = productoActual.stock;
    if (Number.isFinite(stock) && stock > 0 && cantidad > stock) {
        AgroUI.toast(`Solo hay ${stock} unidades disponibles de este producto.`, 'warning', 'Stock limitado');
        return true;
    }
    return false;
}

/** Agrega la cantidad escrita en "Cantidad" (por defecto 1). */
function agregarProductoActual() {
    const campo = document.getElementById('cantidad-inicial');
    const leida = leerCantidadEscrita(campo?.value, productoActual.stock);
    const cantidad = Math.max(leida?.cantidad ?? 1, 1);
    if (leida?.recortada) AgroUI.toast(`Solo hay ${leida.recortada} unidades disponibles de este producto.`, 'warning', 'Stock limitado');
    if (campo) campo.value = '1';

    if (!carritoProducto[productoActual.id]) {
        carritoProducto[productoActual.id] = {
            nombre: productoActual.nombreCompleto,
            precio: productoActual.precio,
                        qty: cantidad,
            stock: productoActual.stock,
            imagen: productoActual.imagen,
            medida: productoActual.medida,
            cantidadCaja: productoActual.cantidadCaja,
            cantidadBolsa: productoActual.cantidadBolsa,
            categoria: productoActual.categoria,
            subcategoria: productoActual.subcategoria
        };
    } else {
                const nueva = carritoProducto[productoActual.id].qty + cantidad;
        if (superaStock(nueva)) return;
        carritoProducto[productoActual.id].qty = nueva;
    }

    guardarCarrito(carritoProducto);
    renderizarCarritoDetalle();
}

/** La persona escribió la cantidad en el carrito (0 = quitar). */
function escribirCantidadActual(campo) {
    const item = carritoProducto[productoActual.id];
    if (!item) return;
    const leida = leerCantidadEscrita(campo.value, productoActual.stock);
    if (!leida) { campo.value = String(item.qty); return; }
    if (leida.recortada) AgroUI.toast(`Solo hay ${leida.recortada} unidades disponibles de este producto.`, 'warning', 'Stock limitado');
    fijarCantidadCarrito(carritoProducto, productoActual.id, leida.cantidad);
    guardarCarrito(carritoProducto);
    renderizarCarritoDetalle();
}

function modificarQtyActual(cambio) {
    if (!carritoProducto[productoActual.id]) return;
    if (cambio > 0 && superaStock(carritoProducto[productoActual.id].qty + cambio)) return;
    carritoProducto[productoActual.id].qty += cambio;
    if (carritoProducto[productoActual.id].qty <= 0) delete carritoProducto[productoActual.id];
    guardarCarrito(carritoProducto);
    renderizarCarritoDetalle();
}

alCargar(() => {
    pintarDetalleProducto();
    document.getElementById('btn-add-main').addEventListener('click', agregarProductoActual);
    document.getElementById('btn-menos').addEventListener('click', () => modificarQtyActual(-1));
        document.getElementById('btn-mas').addEventListener('click', () => modificarQtyActual(1));
    // Cantidad escrita a mano: se aplica al salir del campo o con Enter.
    const campoCarrito = document.getElementById('qty-input-main');
    campoCarrito.addEventListener('change', () => escribirCantidadActual(campoCarrito));
    campoCarrito.addEventListener('focus', () => campoCarrito.select());
    campoCarrito.addEventListener('keydown', e => { if (e.key === 'Enter') campoCarrito.blur(); });
    const campoInicial = document.getElementById('cantidad-inicial');
    campoInicial.addEventListener('focus', () => campoInicial.select());
    campoInicial.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); agregarProductoActual(); } });
    // Vuelve a la misma página y filtros del catálogo de donde vino.
    document.getElementById('link-volver-catalogo').addEventListener('click', event => {
        event.preventDefault();
        let destino = '/';
        try { destino = sessionStorage.getItem('agro_ultimo_catalogo') || '/'; } catch { /* sin almacenamiento */ }
        irA(destino);
    });
    renderizarCarritoDetalle();
});

}

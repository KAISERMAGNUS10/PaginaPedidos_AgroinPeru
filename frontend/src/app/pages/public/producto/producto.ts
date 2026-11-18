// @ts-nocheck
// Migrado de producto.html + producto.js
import { Component, OnDestroy, ViewEncapsulation, afterNextRender } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TiendaHeader } from '../../../shared/tienda-header';
import { ejecutarPagina, type Limpiador } from '../../../core/utils/navegacion';
import { alCargar, irA } from '../../../core/utils/navegacion';
import { cargarCatalogo, obtenerCategoriasCatalogo, obtenerProductoCatalogo } from '../../../core/data/catalogo-data';
import { guardarCarrito, leerCarrito } from '../../../core/utils/carrito-store';
import { conAviso } from '../../../core/utils/precarga';
import { actualizarContadorCarrito } from '../../../core/utils/layout-global';
import { iniciarGlobalPublico } from '../../../core/utils/layout-global';

@Component({
  selector: 'app-producto',
  imports: [RouterLink, TiendaHeader],
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
      conAviso(cargarCatalogo()).then(() => {
      this.limpiar = ejecutarPagina(() => {
        iniciarProducto();
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

function iniciarProducto() {
const productoParams = new URLSearchParams(window.location.search);
const productoId = productoParams.get('id');
const productoActual = productoId ? obtenerProductoCatalogo(productoId) : null;
let carritoProducto = leerCarrito();

if (!productoActual) {
    irA('/');
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

function pintarCategoriasProducto() {
    const contenedor = document.getElementById('product-category-links');
    if (!contenedor) return;
    const categorias = obtenerCategoriasCatalogo();
    contenedor.innerHTML = categorias.map(categoria => `
        <a class="product-category-link" href="/?categoria=${encodeURIComponent(categoria)}">${categoria}</a>
    `).join('');
}

function renderizarCarritoDetalle() {
    const btnInitial = document.getElementById('btn-add-main');
    const qtyControl = document.getElementById('qty-control-main');
    const qtyVal = document.getElementById('qty-val-main');
    const btnMenos = document.getElementById('btn-menos');
    const item = carritoProducto[productoActual.id];

    if (item && item.qty > 0) {
        btnInitial.style.display = 'none';
        qtyControl.style.display = 'flex';
        qtyVal.textContent = `${item.qty} un`;

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

function agregarProductoActual() {
    if (!carritoProducto[productoActual.id]) {
        carritoProducto[productoActual.id] = {
            nombre: productoActual.nombreCompleto,
            precio: productoActual.precio,
            qty: 1,
            imagen: productoActual.imagen,
            medida: productoActual.medida,
            cantidadCaja: productoActual.cantidadCaja,
            cantidadBolsa: productoActual.cantidadBolsa,
            categoria: productoActual.categoria,
            subcategoria: productoActual.subcategoria
        };
    } else {
        carritoProducto[productoActual.id].qty++;
    }

    guardarCarrito(carritoProducto);
    renderizarCarritoDetalle();
}

function modificarQtyActual(cambio) {
    if (!carritoProducto[productoActual.id]) return;
    carritoProducto[productoActual.id].qty += cambio;
    if (carritoProducto[productoActual.id].qty <= 0) delete carritoProducto[productoActual.id];
    guardarCarrito(carritoProducto);
    renderizarCarritoDetalle();
}

alCargar(() => {
    pintarDetalleProducto();
    pintarCategoriasProducto();
    document.getElementById('btn-add-main').addEventListener('click', agregarProductoActual);
    document.getElementById('btn-menos').addEventListener('click', () => modificarQtyActual(-1));
    document.getElementById('btn-mas').addEventListener('click', () => modificarQtyActual(1));
    renderizarCarritoDetalle();
});

}

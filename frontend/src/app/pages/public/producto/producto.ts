// @ts-nocheck
import { Component, OnDestroy, ViewEncapsulation, afterNextRender } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ejecutarPagina, type Limpiador } from '../../../core/utils/navegacion';
import { alCargar, irA } from '../../../core/utils/navegacion';
import { cargarCatalogo, obtenerCategoriasCatalogo, obtenerProductoCatalogo } from '../../../core/data/catalogo-data';
import { guardarCarrito, leerCarrito } from '../../../core/utils/carrito-store';
import { conAviso } from '../../../core/utils/precarga';
import { actualizarContadorCarrito } from '../../../core/utils/layout-global';
import { iniciarGlobalPublico } from '../../../core/utils/layout-global';

@Component({
  selector: 'app-producto',
  imports: [RouterLink],
  templateUrl: './producto.html',
  styleUrls: ['./producto.css', '../../../../styles/header.css', '../../../../styles/tienda.css', '../../../../styles/ui-enhancements.css'],
  // Estilos de la página sin encapsulación y respetando los espacios del HTML.
  encapsulation: ViewEncapsulation.None,
  preserveWhitespaces: true,
  host: { style: 'display: contents' }
})
export class Producto implements OnDestroy {
  private limpiar: Limpiador | null = null;

  constructor() {
    // La lógica necesita que el HTML ya esté en el DOM, por eso corre después del primer render (solo navegador).
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
function iniciarProducto() {
const productoParams = new URLSearchParams(window.location.search);
const productoId = productoParams.get('id');
const productoActual = productoId ? obtenerProductoCatalogo(productoId) : null;
let carritoProducto = leerCarrito();

if (!productoActual) {
    irA('/');
}

function pintarDetalleProducto() {
    document.title = `${productoActual.nombreCompleto} - AIDP`;
    document.getElementById('detalle-nombre').textContent = productoActual.nombre;
    document.getElementById('detalle-medida').textContent = `Medida: ${productoActual.medida}`;
    document.getElementById('detalle-precio').textContent = `Precio referencial: S/ ${productoActual.precio.toFixed(2)}`;
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

        if (item.qty === 1) {
            btnMenos.textContent = '🗑️';
            btnMenos.style.background = 'white';
            btnMenos.style.color = '#00b900';
            btnMenos.style.border = '1px solid #00b900';
        } else {
            btnMenos.textContent = '-';
            btnMenos.style.background = '#00b900';
            btnMenos.style.color = 'white';
            btnMenos.style.border = 'none';
        }
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

function inicializarBusquedaProducto() {
    const input = document.getElementById('header-search-input');
    const boton = document.getElementById('btn-header-search');

    const buscar = () => {
        const texto = input ? input.value.trim() : '';
        irA(texto ? `/?q=${encodeURIComponent(texto)}` : '/');
    };

    if (boton) boton.addEventListener('click', buscar);
    if (input) {
        input.addEventListener('keydown', event => {
            if (event.key === 'Enter') {
                event.preventDefault();
                buscar();
            }
        });
    }
}

alCargar(() => {
    pintarDetalleProducto();
    pintarCategoriasProducto();
    inicializarBusquedaProducto();
    document.getElementById('btn-add-main').addEventListener('click', agregarProductoActual);
    document.getElementById('btn-menos').addEventListener('click', () => modificarQtyActual(-1));
    document.getElementById('btn-mas').addEventListener('click', () => modificarQtyActual(1));
    renderizarCarritoDetalle();
});

}

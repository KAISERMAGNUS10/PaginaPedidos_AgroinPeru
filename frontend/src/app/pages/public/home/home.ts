// @ts-nocheck
import { Component, OnDestroy, ViewEncapsulation, afterNextRender } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ejecutarPagina, type Limpiador } from '../../../core/utils/navegacion';
import { alCargar, onGlobal } from '../../../core/utils/navegacion';
import { CATALOGO_AGRO, cargarCatalogo, obtenerProductoCatalogo } from '../../../core/data/catalogo-data';
import { guardarCarrito, leerCarrito } from '../../../core/utils/carrito-store';
import { conAviso } from '../../../core/utils/precarga';
import { actualizarContadorCarrito } from '../../../core/utils/layout-global';
import { iniciarGlobalPublico } from '../../../core/utils/layout-global';

@Component({
  selector: 'app-home',
  imports: [RouterLink],
  templateUrl: './home.html',
  styleUrls: ['./home.css', '../../../../styles/header.css', '../../../../styles/tienda.css', '../../../../styles/ui-enhancements.css'],
  // Estilos de la página sin encapsulación y respetando los espacios del HTML.
  encapsulation: ViewEncapsulation.None,
  preserveWhitespaces: true,
  host: { style: 'display: contents' }
})
export class Home implements OnDestroy {
  private limpiar: Limpiador | null = null;

  constructor() {
    // La lógica necesita que el HTML ya esté en el DOM, por eso corre después del primer render (solo navegador).
    afterNextRender(() => {
      conAviso(cargarCatalogo()).then(() => {
      this.limpiar = ejecutarPagina(() => {
        iniciarHome();
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
function iniciarHome() {
let carritoLocal = leerCarrito();

function normalizarTexto(valor) {
    return (valor || '')
        .toString()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

function escaparHtml(valor) {
    return (valor || '')
        .toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function textoCaja(producto) {
    return producto.cantidadCaja === null || producto.cantidadCaja === undefined
        ? 'No especificado'
        : `${producto.cantidadCaja} un.`;
}

function textoBolsa(producto) {
    return producto.cantidadBolsa === null || producto.cantidadBolsa === undefined
        ? 'No aplica'
        : `${producto.cantidadBolsa} un.`;
}



function renderizarCatalogoProductos() {
    const grid = document.getElementById('product-grid');
    if (!grid) return;

    grid.innerHTML = CATALOGO_AGRO.map(producto => `
        <article class="product-card"
            data-id="${escaparHtml(producto.id)}"
            data-nombre="${escaparHtml(producto.nombreCompleto)}"
            data-precio="${producto.precio.toFixed(2)}"
            data-categoria="${escaparHtml(producto.categoria)}"
            data-subcategoria="${escaparHtml(producto.subcategoria)}"
            data-medida="${escaparHtml(producto.medida)}">
            <div class="product-badges-top">
                <span class="badge badge-category">${escaparHtml(producto.categoria)}</span>
                <span class="badge badge-subcategory">${escaparHtml(producto.subcategoria)}</span>
            </div>
            <a href="/producto?id=${encodeURIComponent(producto.id)}">
                <div class="product-image-wrap">
                    <img src="${escaparHtml(producto.imagen)}" alt="${escaparHtml(producto.nombreCompleto)}" onerror="this.src='img/logoagroperu.jpg'">
                </div>
                <div class="product-copy">
                    <p class="product-measure-chip">${escaparHtml(producto.medida)}</p>
                    <h4>${escaparHtml(producto.nombre)}</h4>
                </div>
            </a>
            <div class="product-specs">
                <span><strong>Presentación caja:</strong> ${textoCaja(producto)}</span>
                <span><strong>Presentación bolsa:</strong> ${textoBolsa(producto)}</span>
            </div>
            <div class="price-box">
                <small>Precio referencial</small>
                <p class="price">S/ ${producto.precio.toFixed(2)}</p>
            </div>
            <div class="cart-controls">
                <button class="btn-add-initial" type="button" data-cart-action="add" data-id="${escaparHtml(producto.id)}">+ Agregar al carrito</button>
                <div class="qty-control" style="display:none;">
                    <button class="qty-btn trash" type="button" data-cart-action="minus" data-id="${escaparHtml(producto.id)}">🗑️</button>
                    <span class="qty-val">1 un</span>
                    <button class="qty-btn" type="button" data-cart-action="plus" data-id="${escaparHtml(producto.id)}">+</button>
                </div>
            </div>
        </article>
    `).join('');

    grid.addEventListener('click', event => {
        const boton = event.target.closest('[data-cart-action]');
        if (!boton) return;
        event.preventDefault();
        const id = boton.dataset.id;
        const accion = boton.dataset.cartAction;
        if (accion === 'add') agregarProducto(id);
        if (accion === 'plus') modificarQty(id, 1);
        if (accion === 'minus') modificarQty(id, -1);
    });
}

function renderizarCategorias() {
    const contenedor = document.getElementById('category-filter-list');
    if (!contenedor) return;

    const categorias = Array.from(new Set(CATALOGO_AGRO.map(producto => producto.categoria)));
    contenedor.innerHTML = categorias.map(categoria => {
        const cantidad = CATALOGO_AGRO.filter(producto => producto.categoria === categoria).length;
        return `
            <label>
                <input type="checkbox" class="category-filter" value="${escaparHtml(categoria)}">
                <span>${escaparHtml(categoria)}</span>
                <span class="category-count">${cantidad}</span>
            </label>
        `;
    }).join('');
}

function renderizarCarrito() {
    if (typeof actualizarContadorCarrito === 'function') actualizarContadorCarrito();

    document.querySelectorAll('.product-card').forEach(card => {
        const id = card.dataset.id;
        const btnInitial = card.querySelector('.btn-add-initial');
        const qtyControl = card.querySelector('.qty-control');
        const qtyVal = card.querySelector('.qty-val');
        const btnMenos = qtyControl ? qtyControl.querySelector('[data-cart-action="minus"]') : null;
        const item = carritoLocal[id];

        if (item && item.qty > 0) {
            if (btnInitial) btnInitial.style.display = 'none';
            if (qtyControl) qtyControl.style.display = 'flex';
            if (qtyVal) qtyVal.textContent = `${item.qty} un`;

            if (btnMenos) {
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
            }
        } else {
            if (btnInitial) btnInitial.style.display = 'flex';
            if (qtyControl) qtyControl.style.display = 'none';
        }
    });
}

function agregarProducto(id) {
    const producto = obtenerProductoCatalogo(id);
    if (!producto) return;

    if (!carritoLocal[id]) {
        carritoLocal[id] = {
            nombre: producto.nombreCompleto,
            precio: producto.precio,
            qty: 1,
            imagen: producto.imagen,
            medida: producto.medida,
            cantidadCaja: producto.cantidadCaja,
            cantidadBolsa: producto.cantidadBolsa,
            categoria: producto.categoria,
            subcategoria: producto.subcategoria
        };
    } else {
        carritoLocal[id].qty++;
    }

    guardarCarrito(carritoLocal);
    renderizarCarrito();
}

function modificarQty(id, cambio) {
    if (!carritoLocal[id]) return;

    carritoLocal[id].qty += cambio;
    if (carritoLocal[id].qty <= 0) delete carritoLocal[id];

    guardarCarrito(carritoLocal);
    renderizarCarrito();
}

function obtenerCategoriasSeleccionadas() {
    return Array.from(document.querySelectorAll('.category-filter:checked')).map(input => input.value);
}

function aplicarFiltros() {
    const inputBusqueda = document.getElementById('header-search-input');
    const textoResultado = document.getElementById('catalog-result-text');
    const emptyState = document.getElementById('catalog-empty');
    const grid = document.getElementById('product-grid');
    const btnReset = document.getElementById('btn-reset-catalog');
    const query = normalizarTexto(inputBusqueda ? inputBusqueda.value : '');
    const categorias = obtenerCategoriasSeleccionadas();
    const cards = Array.from(document.querySelectorAll('.product-card'));
    let visibles = 0;

    cards.forEach(card => {
        const texto = normalizarTexto([
            card.dataset.nombre,
            card.dataset.categoria,
            card.dataset.subcategoria,
            card.dataset.medida,
            card.textContent
        ].join(' '));
        const coincideTexto = !query || texto.includes(query);
        const coincideCategoria = categorias.length === 0 || categorias.includes(card.dataset.categoria);
        const visible = coincideTexto && coincideCategoria;

        card.hidden = !visible;
        card.classList.toggle('producto-oculto', !visible);
        if (visible) visibles++;
    });

    const hayFiltros = query.length > 0 || categorias.length > 0;
    if (grid) grid.hidden = visibles === 0;
    if (emptyState) emptyState.hidden = visibles !== 0;
    if (btnReset) btnReset.hidden = !hayFiltros;

    if (textoResultado) {
        if (!hayFiltros) textoResultado.textContent = `Mostrando ${cards.length} productos con formato comercial`;
        else if (visibles === 0) textoResultado.textContent = '0 productos encontrados';
        else textoResultado.textContent = `${visibles} producto${visibles === 1 ? '' : 's'} encontrado${visibles === 1 ? '' : 's'}`;
    }
}

function limpiarFiltrosCatalogo() {
    const inputBusqueda = document.getElementById('header-search-input');
    if (inputBusqueda) inputBusqueda.value = '';
    document.querySelectorAll('.category-filter').forEach(input => input.checked = false);
    aplicarFiltros();
}

function inicializarCatalogo() {
    const inputBusqueda = document.getElementById('header-search-input');
    const btnBusqueda = document.getElementById('btn-header-search');
    const btnClear = document.getElementById('btn-clear-filters');
    const btnReset = document.getElementById('btn-reset-catalog');
    const btnEmptyReset = document.getElementById('btn-empty-reset');
    const params = new URLSearchParams(window.location.search);
    const queryInicial = params.get('q');
    const categoriaInicial = params.get('categoria');

    if (inputBusqueda && queryInicial) inputBusqueda.value = queryInicial;

    if (categoriaInicial) {
        document.querySelectorAll('.category-filter').forEach(input => {
            input.checked = input.value === categoriaInicial;
        });
    }

    if (inputBusqueda) {
        inputBusqueda.addEventListener('input', aplicarFiltros);
        inputBusqueda.addEventListener('keydown', event => {
            if (event.key === 'Enter') {
                event.preventDefault();
                aplicarFiltros();
            }
        });
    }

    if (btnBusqueda) btnBusqueda.addEventListener('click', aplicarFiltros);
    if (btnClear) btnClear.addEventListener('click', limpiarFiltrosCatalogo);
    if (btnReset) btnReset.addEventListener('click', limpiarFiltrosCatalogo);
    if (btnEmptyReset) btnEmptyReset.addEventListener('click', limpiarFiltrosCatalogo);

    onGlobal(document, 'change', event => {
        if (event.target.classList.contains('category-filter')) aplicarFiltros();
    });

    renderizarCategorias();
    renderizarCatalogoProductos();
    renderizarCarrito();
    aplicarFiltros();
}

alCargar(inicializarCatalogo);

}

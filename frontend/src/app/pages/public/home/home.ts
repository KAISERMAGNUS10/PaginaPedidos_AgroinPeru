// @ts-nocheck
// Catálogo de la tienda: tarjetas de productos, buscador, filtro por categorías y orden.
import { Component, OnDestroy, ViewEncapsulation, afterNextRender } from '@angular/core';
import { TiendaHeader } from '../../../shared/tienda-header';
import { ejecutarPagina, type Limpiador } from '../../../core/utils/navegacion';
import { alCargar, onGlobal } from '../../../core/utils/navegacion';
import { CATALOGO_AGRO, cargarCatalogo, obtenerProductoCatalogo } from '../../../core/data/catalogo-data';
import { guardarCarrito, leerCarrito } from '../../../core/utils/carrito-store';
import { conAviso } from '../../../core/utils/precarga';
import { actualizarContadorCarrito } from '../../../core/utils/layout-global';
import { iniciarGlobalPublico } from '../../../core/utils/layout-global';

@Component({
  selector: 'app-home',
  imports: [TiendaHeader],
  templateUrl: './home.html',
  styleUrls: ['./home.css', '../../../../styles/header.css', '../../../../styles/tienda.css', '../../../../styles/ui-enhancements.css'],
  encapsulation: ViewEncapsulation.None,
  preserveWhitespaces: true,
  host: { style: 'display: contents' }
})
export class Home implements OnDestroy {
  private limpiar: Limpiador | null = null;

  constructor() {
    // El código de la página trabaja sobre el HTML ya pintado, por eso corre después del primer render (solo navegador).
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

const ICONO_PAPELERA = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18 M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6 M10 11v6 M14 11v6 M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>';

function iniciarHome() {
let carritoLocal = leerCarrito();

/** Minúsculas, sin tildes y con los símbolos de medida unificados (° " ″ ×). */
function normalizarTexto(valor) {
    return (valor || '')
        .toString()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[″”“]/g, '"')
        .replace(/×/g, 'x')
        .replace(/\s+/g, ' ')
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

    grid.innerHTML = CATALOGO_AGRO.map((producto, posicion) => `
        <article class="product-card"
            data-id="${escaparHtml(producto.id)}"
            data-posicion="${posicion}"
            data-nombre="${escaparHtml(producto.nombreCompleto)}"
            data-precio="${producto.precio.toFixed(2)}"
            data-categoria="${escaparHtml(producto.categoria)}"
            data-busqueda="${escaparHtml(normalizarTexto([producto.nombreCompleto, producto.categoria, producto.subcategoria, producto.medida, producto.id].join(' ')))}">
            <a href="/producto?id=${encodeURIComponent(producto.id)}">
                <div class="product-image-wrap">
                    <img src="${escaparHtml(producto.imagen)}" alt="${escaparHtml(producto.nombreCompleto)}" loading="lazy" decoding="async" width="400" height="400" onerror="this.src='img/logoagroperu.jpg'">
                </div>
                <div class="product-copy">
                    <span class="product-cat">${escaparHtml(producto.subcategoria || producto.categoria)}</span>
                    <h4>${escaparHtml(producto.nombre)}</h4>
                    <p class="product-measure-chip">${escaparHtml(producto.medida)}</p>
                </div>
            </a>
            <div class="product-specs">
                <span>Caja: <strong>${textoCaja(producto)}</strong></span>
                <span>Bolsa: <strong>${textoBolsa(producto)}</strong></span>
            </div>
            <div class="price-box">
                <p class="price">S/ ${producto.precio.toFixed(2)}</p>
                <small>inc. IGV</small>
            </div>
            <div class="cart-controls">
                <button class="btn-add-initial" type="button" data-cart-action="add" data-id="${escaparHtml(producto.id)}">Agregar al carrito</button>
                <div class="qty-control" style="display:none;">
                    <button class="qty-btn trash" type="button" data-cart-action="minus" data-id="${escaparHtml(producto.id)}" aria-label="Quitar uno">${ICONO_PAPELERA}</button>
                    <span class="qty-val">1 un</span>
                    <button class="qty-btn" type="button" data-cart-action="plus" data-id="${escaparHtml(producto.id)}" aria-label="Agregar uno">+</button>
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

/** Chips de categorías: cada uno es un checkbox (se pueden elegir varias). */
function renderizarCategorias() {
    const contenedor = document.getElementById('category-filter-list');
    if (!contenedor) return;

    const categorias = Array.from(new Set(CATALOGO_AGRO.map(producto => producto.categoria)));
    contenedor.innerHTML = categorias.map(categoria => {
        const cantidad = CATALOGO_AGRO.filter(producto => producto.categoria === categoria).length;
        return `
            <label class="chip">
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
                const unidad = item.qty === 1;
                btnMenos.classList.toggle('trash', unidad);
                btnMenos.innerHTML = unidad ? ICONO_PAPELERA : '−';
                btnMenos.setAttribute('aria-label', unidad ? 'Quitar del carrito' : 'Quitar uno');
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

/** Ordena las tarjetas sin volver a pintarlas (así no se pierde el estado del carrito). */
function ordenarTarjetas() {
    const grid = document.getElementById('product-grid');
    const orden = document.getElementById('catalog-sort')?.value || 'relevancia';
    if (!grid) return;

    const cards = Array.from(grid.querySelectorAll('.product-card'));
    const precio = c => Number(c.dataset.precio);
    const comparar = {
        'precio-asc': (a, b) => precio(a) - precio(b),
        'precio-desc': (a, b) => precio(b) - precio(a),
        'nombre': (a, b) => a.dataset.nombre.localeCompare(b.dataset.nombre, 'es', { numeric: true }),
        'relevancia': (a, b) => Number(a.dataset.posicion) - Number(b.dataset.posicion)
    }[orden];
    cards.sort(comparar).forEach(card => grid.appendChild(card));
}

/** Busca por palabras: "codo 1/2" encuentra los codos de 1/2" aunque las palabras estén separadas. */
function aplicarFiltros() {
    const inputBusqueda = document.getElementById('header-search-input');
    const textoResultado = document.getElementById('catalog-result-text');
    const emptyState = document.getElementById('catalog-empty');
    const grid = document.getElementById('product-grid');
    const btnReset = document.getElementById('btn-reset-catalog');
    const query = normalizarTexto(inputBusqueda ? inputBusqueda.value : '');
    const palabras = query ? query.split(' ') : [];
    const categorias = obtenerCategoriasSeleccionadas();
    const cards = Array.from(document.querySelectorAll('.product-card'));
    let visibles = 0;

    cards.forEach(card => {
        const texto = card.dataset.busqueda || '';
        const coincideTexto = palabras.every(p => texto.includes(p));
        const coincideCategoria = categorias.length === 0 || categorias.includes(card.dataset.categoria);
        const visible = coincideTexto && coincideCategoria;

        card.hidden = !visible;
        card.classList.toggle('producto-oculto', !visible);
        if (visible) visibles++;
    });

    const hayFiltros = palabras.length > 0 || categorias.length > 0;
    if (grid) grid.hidden = visibles === 0;
    if (emptyState) emptyState.hidden = visibles !== 0;
    if (btnReset) btnReset.hidden = !hayFiltros;

    if (textoResultado) {
        const busqueda = inputBusqueda && inputBusqueda.value.trim() ? ` para "${inputBusqueda.value.trim()}"` : '';
        if (!hayFiltros) textoResultado.textContent = `${cards.length} productos`;
        else if (visibles === 0) textoResultado.textContent = `Sin resultados${busqueda}`;
        else textoResultado.textContent = `${visibles} producto${visibles === 1 ? '' : 's'}${busqueda}`;
    }
}

function limpiarFiltrosCatalogo() {
    const inputBusqueda = document.getElementById('header-search-input');
    if (inputBusqueda) inputBusqueda.value = '';
    document.querySelectorAll('.category-filter').forEach(input => input.checked = false);
    aplicarFiltros();
}

/** Desde el menú lateral se elige una sola categoría ('' = todas). */
function elegirSoloCategoria(categoria) {
    document.querySelectorAll('.category-filter').forEach(input => {
        input.checked = !!categoria && input.value === categoria;
    });
    aplicarFiltros();
}

function inicializarCatalogo() {
    const inputBusqueda = document.getElementById('header-search-input');
    const btnReset = document.getElementById('btn-reset-catalog');
    const btnEmptyReset = document.getElementById('btn-empty-reset');
    const selectOrden = document.getElementById('catalog-sort');
    const params = new URLSearchParams(window.location.search);
    const queryInicial = params.get('q');
    const categoriaInicial = params.get('categoria');

    // Primero se pintan las categorías y los productos; luego se aplican los filtros que vienen en la URL.
    renderizarCategorias();
    renderizarCatalogoProductos();
    renderizarCarrito();

    if (inputBusqueda && queryInicial) inputBusqueda.value = queryInicial;
    if (categoriaInicial) {
        document.querySelectorAll('.category-filter').forEach(input => {
            input.checked = input.value === categoriaInicial;
        });
    }

    if (inputBusqueda) {
        inputBusqueda.addEventListener('input', aplicarFiltros);
        inputBusqueda.addEventListener('search', aplicarFiltros); // la "x" del buscador
        inputBusqueda.addEventListener('keydown', event => {
            if (event.key === 'Enter') {
                event.preventDefault();
                aplicarFiltros();
                document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth' });
            }
        });
    }

    if (btnReset) btnReset.addEventListener('click', limpiarFiltrosCatalogo);
    if (btnEmptyReset) btnEmptyReset.addEventListener('click', limpiarFiltrosCatalogo);
    if (selectOrden) selectOrden.addEventListener('change', ordenarTarjetas);

    onGlobal(document, 'change', event => {
        if (event.target.classList.contains('category-filter')) aplicarFiltros();
    });
    onGlobal(window, 'agro:categoria', event => elegirSoloCategoria(event.detail));

    aplicarFiltros();
    if (queryInicial || categoriaInicial) {
        document.getElementById('catalogo')?.scrollIntoView();
    }
}

alCargar(inicializarCatalogo);

}

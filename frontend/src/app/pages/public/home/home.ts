// @ts-nocheck
// Catálogo de la tienda por páginas: 12 productos a la vez, con buscador, categorías y orden.
// El backend filtra, ordena y pagina (GET /api/public/productos?pagina=…); aquí solo se pinta.
import { Component, OnDestroy, ViewEncapsulation, afterNextRender } from '@angular/core';
import { TiendaHeader } from '../../../shared/tienda-header';
import { ejecutarPagina, onGlobal, alLimpiar, type Limpiador } from '../../../core/utils/navegacion';
import { cargarCategorias, cargarPaginaCatalogo } from '../../../core/data/catalogo-data';
import { fijarCantidadCarrito, guardarCarrito, leerCantidadEscrita, leerCarrito } from '../../../core/utils/carrito-store';
import { AgroUI } from '../../../core/utils/agro-ui';
import { mensajeError } from '../../../core/utils/api';
import { actualizarContadorCarrito, iniciarGlobalPublico } from '../../../core/utils/layout-global';

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
    // Trabaja sobre el HTML ya pintado: corre después del primer render (solo navegador).
    afterNextRender(() => {
      this.limpiar = ejecutarPagina(() => {
        iniciarHome();
        iniciarGlobalPublico();
      });
    });
  }

  ngOnDestroy(): void {
    this.limpiar?.();
  }
}

const POR_PAGINA = 12;
const ORDENES = ['relevancia', 'precio-asc', 'precio-desc', 'nombre'];
const ICONO_PAPELERA = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18 M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6 M10 11v6 M14 11v6 M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>';

function iniciarHome() {
const $ = id => document.getElementById(id);
let carritoLocal = leerCarrito();
/** Productos de la página que se ve (para agregarlos al carrito). */
let productosVisibles = new Map();
/** Cada pedido a la API lleva un número: si llega una respuesta vieja, se ignora. */
let ultimoPedido = 0;
let temporizadorBusqueda = null;

// Estado inicial desde la URL: /?q=codo&categoria=Mangueras,Válvulas&orden=precio-asc&pagina=2
const params = new URLSearchParams(window.location.search);
const estado = {
    pagina: Math.max(parseInt(params.get('pagina') || '1', 10) || 1, 1),
    q: params.get('q') || '',
    categorias: (params.get('categoria') || '').split(',').map(c => c.trim()).filter(Boolean),
    orden: ORDENES.includes(params.get('orden')) ? params.get('orden') : 'relevancia'
};

function escaparHtml(valor) {
    return (valor ?? '').toString()
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

const textoCaja = p => p.cantidadCaja == null ? 'No especificado' : `${p.cantidadCaja} un.`;
const textoBolsa = p => p.cantidadBolsa == null ? 'No aplica' : `${p.cantidadBolsa} un.`;

/* ------------------------- URL ------------------------- */

/** Guarda los filtros en la URL (así se puede recargar o compartir la página). */
function actualizarUrl() {
    const p = new URLSearchParams();
    if (estado.q.trim()) p.set('q', estado.q.trim());
    if (estado.categorias.length) p.set('categoria', estado.categorias.join(','));
    if (estado.orden !== 'relevancia') p.set('orden', estado.orden);
    if (estado.pagina > 1) p.set('pagina', String(estado.pagina));
    const url = '/' + (p.toString() ? `?${p}` : '');
        if (url !== window.location.pathname + window.location.search) {
        history.replaceState(history.state, '', url);
    }
    // El detalle de producto usa esto para "Volver al catálogo" (misma página y filtros).
    try { sessionStorage.setItem('agro_ultimo_catalogo', url); } catch { /* sin almacenamiento */ }
}

/* ------------------------- Tarjetas ------------------------- */

function tarjeta(producto) {
    const id = escaparHtml(producto.id);
    return `
        <article class="product-card" data-id="${id}">
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
                <p class="price">S/ ${Number(producto.precio).toFixed(2)}</p>
                <small>inc. IGV</small>
            </div>
            <div class="cart-controls">
                <button class="btn-add-initial" type="button" data-cart-action="add" data-id="${id}">Agregar al carrito</button>
                <div class="qty-control" style="display:none;">
                    <button class="qty-btn trash" type="button" data-cart-action="minus" data-id="${id}" aria-label="Quitar uno">${ICONO_PAPELERA}</button>
                    <label class="qty-campo"><input class="qty-input" type="number" inputmode="numeric" min="0" max="999" value="1" data-id="${id}" aria-label="Cantidad de ${escaparHtml(producto.nombreCompleto)}"><span>un</span></label>
                    <button class="qty-btn" type="button" data-cart-action="plus" data-id="${id}" aria-label="Agregar uno">+</button>
                </div>
            </div>
        </article>`;
}

/** Tarjetas grises mientras llega la página (el usuario ve que algo está cargando). */
function pintarEsqueleto() {
    const grid = $('product-grid');
    if (!grid) return;
    grid.hidden = false;
    grid.innerHTML = Array.from({ length: POR_PAGINA }, () => `
        <div class="product-card esqueleto" aria-hidden="true">
            <div class="product-image-wrap"></div>
            <span class="esq-linea corta"></span>
            <span class="esq-linea"></span>
            <span class="esq-linea media"></span>
            <span class="esq-boton"></span>
        </div>`).join('');
}

/* ------------------------- Carrito ------------------------- */

function renderizarCarrito() {
    actualizarContadorCarrito();

    document.querySelectorAll('.product-card[data-id]').forEach(card => {
        const item = carritoLocal[card.dataset.id];
        const btnInitial = card.querySelector('.btn-add-initial');
        const qtyControl = card.querySelector('.qty-control');
        const btnMenos = card.querySelector('[data-cart-action="minus"]');

        if (item && item.qty > 0) {
            btnInitial.style.display = 'none';
            qtyControl.style.display = 'flex';
            const campo = card.querySelector('.qty-input');
            if (document.activeElement !== campo) campo.value = String(item.qty);
            const unidad = item.qty === 1;
            btnMenos.classList.toggle('trash', unidad);
            btnMenos.innerHTML = unidad ? ICONO_PAPELERA : '−';
            btnMenos.setAttribute('aria-label', unidad ? 'Quitar del carrito' : 'Quitar uno');
        } else {
            btnInitial.style.display = 'flex';
            qtyControl.style.display = 'none';
        }
    });
}

function agregarProducto(id) {
    const producto = productosVisibles.get(id);
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
            subcategoria: producto.subcategoria,
            stock: producto.stock
        };
    } else {
        if (superaStock(id, carritoLocal[id].qty + 1)) return;
        carritoLocal[id].qty++;
    }
    guardarCarrito(carritoLocal);
    renderizarCarrito();
}

/** La persona escribió la cantidad directamente (0 = quitar del carrito). */
function escribirCantidad(campo) {
    const id = campo.dataset.id;
    if (!carritoLocal[id]) return;
    const leida = leerCantidadEscrita(campo.value, productosVisibles.get(id)?.stock);
    if (!leida) { campo.value = String(carritoLocal[id].qty); return; }
    if (leida.recortada) AgroUI.toast(`Solo hay ${leida.recortada} unidades disponibles de este producto.`, 'warning', 'Stock limitado');
    fijarCantidadCarrito(carritoLocal, id, leida.cantidad);
    guardarCarrito(carritoLocal);
    renderizarCarrito();
}

/** Avisa si se pide más de lo que hay en stock. */
function superaStock(id, cantidad) {
    const stock = productosVisibles.get(id)?.stock ?? carritoLocal[id]?.stock;
    if (Number.isFinite(stock) && stock > 0 && cantidad > stock) {
        AgroUI.toast(`Solo hay ${stock} unidades disponibles de este producto.`, 'warning', 'Stock limitado');
        return true;
    }
    return false;
}

function modificarQty(id, cambio) {
    if (!carritoLocal[id]) return;
    if (cambio > 0 && superaStock(id, carritoLocal[id].qty + cambio)) return;
    carritoLocal[id].qty += cambio;
    if (carritoLocal[id].qty <= 0) delete carritoLocal[id];
    guardarCarrito(carritoLocal);
    renderizarCarrito();
}

/* ------------------------- Paginación ------------------------- */

/** Números a mostrar: 1 … 4 5 [6] 7 8 … 34 (los "lejanos" se ocultan en celular). */
function numerosPagina(actual, total) {
    const lista = [];
    for (let n = 1; n <= total; n++) {
        const distancia = Math.abs(n - actual);
        if (n === 1 || n === total || distancia <= 2) lista.push({ n, lejos: distancia === 2 && n !== 1 && n !== total });
        else if (lista[lista.length - 1]?.n !== '…') lista.push({ n: '…' });
    }
    return lista;
}

function pintarPaginacion(pagina, paginas) {
    const nav = $('paginacion');
    if (!nav) return;
    nav.hidden = paginas <= 1;
    if (paginas <= 1) { nav.innerHTML = ''; return; }

    const boton = (n, texto, extra = '') =>
        `<button type="button" class="pag-btn ${extra}" data-pagina="${n}" ${n === pagina ? 'aria-current="page"' : ''}>${texto}</button>`;

    nav.innerHTML = `
        <button type="button" class="pag-btn pag-flecha" data-pagina="${pagina - 1}" ${pagina === 1 ? 'disabled' : ''} aria-label="Página anterior">
            <span aria-hidden="true">‹</span><span class="pag-texto">Anterior</span>
        </button>
        <div class="pag-numeros">
            ${numerosPagina(pagina, paginas).map(x => x.n === '…'
                ? '<span class="pag-puntos" aria-hidden="true">…</span>'
                : boton(x.n, x.n, (x.n === pagina ? 'activa' : '') + (x.lejos ? ' lejos' : ''))).join('')}
        </div>
        <span class="pag-resumen">Página ${pagina} de ${paginas}</span>
        <button type="button" class="pag-btn pag-flecha" data-pagina="${pagina + 1}" ${pagina === paginas ? 'disabled' : ''} aria-label="Página siguiente">
            <span class="pag-texto">Siguiente</span><span aria-hidden="true">›</span>
        </button>`;
}

/* ------------------------- Cargar página ------------------------- */

async function cargar({ desplazar = false } = {}) {
    const numero = ++ultimoPedido;
    actualizarUrl();
    pintarEsqueleto();
    $('catalog-empty').hidden = true;
    $('btn-reset-catalog').hidden = !(estado.q.trim() || estado.categorias.length);
    if (desplazar) $('catalogo')?.scrollIntoView({ behavior: 'smooth', block: 'start' });

    let datos;
    try {
        datos = await cargarPaginaCatalogo({ ...estado, limite: POR_PAGINA });
    } catch (error) {
        if (numero !== ultimoPedido) return;
        $('product-grid').innerHTML = '';
        $('catalog-result-text').textContent = 'No se pudo cargar el catálogo';
        const vacio = $('catalog-empty');
        vacio.querySelector('h3').textContent = 'No se pudo cargar el catálogo';
        vacio.querySelector('p').textContent = mensajeError(error);
        vacio.hidden = false;
        $('paginacion').hidden = true;
        return;
    }
    if (numero !== ultimoPedido) return; // llegó tarde: ya se pidió otra página

    estado.pagina = datos.pagina;
    actualizarUrl();
    productosVisibles = new Map(datos.productos.map(p => [p.id, p]));

    const grid = $('product-grid');
    grid.innerHTML = datos.productos.map(tarjeta).join('');
    grid.hidden = datos.productos.length === 0;
    renderizarCarrito();

    const vacio = $('catalog-empty');
    vacio.querySelector('h3').textContent = 'No encontramos productos';
    vacio.querySelector('p').textContent = 'Revisa cómo lo escribiste, prueba con una palabra más corta (por ejemplo "codo" o "1/2") o quita los filtros.';
    vacio.hidden = datos.total !== 0;

    const busqueda = estado.q.trim() ? ` para "${estado.q.trim()}"` : '';
    const desde = (datos.pagina - 1) * datos.limite + 1;
    const hasta = desde + datos.productos.length - 1;
    $('catalog-result-text').textContent = datos.total === 0
        ? `Sin resultados${busqueda}`
        : `${desde}–${hasta} de ${datos.total} producto${datos.total === 1 ? '' : 's'}${busqueda}`;

    pintarPaginacion(datos.pagina, datos.paginas);
}

/* ------------------------- Categorías ------------------------- */

async function pintarCategorias() {
    const contenedor = $('category-filter-list');
    if (!contenedor) return;
    try {
        const lista = await cargarCategorias();
        contenedor.innerHTML = lista.map(c => `
            <label class="chip">
                <input type="checkbox" class="category-filter" value="${escaparHtml(c.nombre)}" ${estado.categorias.includes(c.nombre) ? 'checked' : ''}>
                <span>${escaparHtml(c.nombre)}</span>
                <span class="category-count">${c.cantidad}</span>
            </label>`).join('');
        const total = lista.reduce((s, c) => s + c.cantidad, 0);
        if ($('hero-total')) $('hero-total').textContent = String(total);
    } catch {
        contenedor.innerHTML = '';
    }
}

function categoriasMarcadas() {
    return Array.from(document.querySelectorAll('.category-filter:checked')).map(i => i.value);
}

function limpiarFiltros() {
    estado.q = '';
    estado.categorias = [];
    estado.pagina = 1;
    const input = $('header-search-input');
    if (input) input.value = '';
    document.querySelectorAll('.category-filter').forEach(i => (i.checked = false));
    cargar();
}

/* ------------------------- Eventos ------------------------- */

function inicializar() {
    const input = $('header-search-input');
    const orden = $('catalog-sort');

    if (input) {
        input.value = estado.q;
        // Busca mientras se escribe, pero espera 350 ms a que la persona deje de teclear.
        const buscar = (inmediato) => {
            clearTimeout(temporizadorBusqueda);
            const ejecutar = () => {
                if (input.value === estado.q) return;
                estado.q = input.value;
                estado.pagina = 1;
                cargar();
            };
            if (inmediato) ejecutar(); else temporizadorBusqueda = setTimeout(ejecutar, 350);
        };
        input.addEventListener('input', () => buscar(false));
        input.addEventListener('search', () => buscar(true)); // la "x" del buscador
        input.addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                e.preventDefault();
                buscar(true);
                $('catalogo')?.scrollIntoView({ behavior: 'smooth' });
            }
        });
        alLimpiar(() => clearTimeout(temporizadorBusqueda));
    }

    if (orden) {
        orden.value = estado.orden;
        orden.addEventListener('change', () => {
            estado.orden = orden.value;
            estado.pagina = 1;
            cargar();
        });
    }

    $('product-grid').addEventListener('click', event => {
        const boton = event.target.closest('[data-cart-action]');
        if (!boton) return;
        event.preventDefault();
        const { id, cartAction } = boton.dataset;
        if (cartAction === 'add') agregarProducto(id);
        if (cartAction === 'plus') modificarQty(id, 1);
        if (cartAction === 'minus') modificarQty(id, -1);
    });

        // Campo de cantidad: se aplica al salir del campo o con Enter; al entrar se selecciona el número.
    $('product-grid').addEventListener('change', event => {
        if (event.target.classList.contains('qty-input')) escribirCantidad(event.target);
    });
    $('product-grid').addEventListener('keydown', event => {
        if (event.key === 'Enter' && event.target.classList.contains('qty-input')) event.target.blur();
    });
    $('product-grid').addEventListener('focusin', event => {
        if (event.target.classList.contains('qty-input')) event.target.select();
    });

    $('paginacion').addEventListener('click', event => {
        const boton = event.target.closest('[data-pagina]');
        if (!boton || boton.disabled) return;
        const n = Number(boton.dataset.pagina);
        if (!n || n === estado.pagina) return;
        estado.pagina = n;
        cargar({ desplazar: true });
    });

    $('btn-reset-catalog')?.addEventListener('click', limpiarFiltros);
    $('btn-empty-reset')?.addEventListener('click', limpiarFiltros);

    onGlobal(document, 'change', event => {
        if (!event.target.classList?.contains('category-filter')) return;
        estado.categorias = categoriasMarcadas();
        estado.pagina = 1;
        cargar();
    });

    // Desde el menú lateral se elige una sola categoría ('' = todas).
    onGlobal(window, 'agro:categoria', event => {
        const categoria = event.detail;
        estado.categorias = categoria ? [categoria] : [];
        estado.pagina = 1;
        document.querySelectorAll('.category-filter').forEach(i => (i.checked = estado.categorias.includes(i.value)));
        cargar();
    });

    pintarCategorias();
    cargar();
    if (estado.q || estado.categorias.length || estado.pagina > 1) $('catalogo')?.scrollIntoView();
}

inicializar();
}

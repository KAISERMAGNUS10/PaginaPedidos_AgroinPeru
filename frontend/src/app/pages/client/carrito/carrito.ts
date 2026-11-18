// @ts-nocheck
// Migrado de carrito.html + script en línea
import { Component, OnDestroy, ViewEncapsulation, afterNextRender } from '@angular/core';
import { TiendaHeader } from '../../../shared/tienda-header';
import { ejecutarPagina, type Limpiador } from '../../../core/utils/navegacion';
import { alCargar, irA } from '../../../core/utils/navegacion';
import { obtenerSesionSegura } from '../../../core/utils/auth-storage';
import { fijarCantidadCarrito, guardarCarrito, leerCantidadEscrita, leerCarrito } from '../../../core/utils/carrito-store';
import { AgroUI } from '../../../core/utils/agro-ui';
import { actualizarContadorCarrito } from '../../../core/utils/layout-global';
import { iniciarGlobalPublico } from '../../../core/utils/layout-global';

@Component({
  selector: 'app-carrito',
  imports: [TiendaHeader],
  templateUrl: './carrito.html',
  styleUrls: ['../../../../styles/header.css', './carrito.css', '../../../../styles/ui-enhancements.css'],
  // Se conserva el CSS original tal cual: sin encapsulación y respetando los espacios del HTML viejo.
  encapsulation: ViewEncapsulation.None,
  preserveWhitespaces: true,
  host: { style: 'display: contents' }
})
export class Carrito implements OnDestroy {
  private limpiar: Limpiador | null = null;

  constructor() {
    // El JS original necesita que el HTML ya esté en el DOM, por eso corre después del primer render (solo navegador).
    afterNextRender(() => {
      this.limpiar = ejecutarPagina(() => {
        iniciarGlobalPublico();
        iniciarCarrito();
      });
    });
  }

  ngOnDestroy(): void {
    this.limpiar?.();
    if (typeof window !== 'undefined') {
      delete (window as any).eliminarProducto;
            delete (window as any).modificarCantidad;
      delete (window as any).escribirCantidad;
    }
  }
}

// ==========================================================================
// LÓGICA ORIGINAL (copiada tal cual del proyecto viejo)
// ==========================================================================
function iniciarCarrito() {

        const cartListContainer = document.getElementById('cart-list-container');
        const summaryQty = document.getElementById('summary-qty');
        const cartTitleQty = document.getElementById('cart-title-qty');
        const summaryTotal = document.getElementById('summary-total');
        const summarySubtotal = document.getElementById('summary-subtotal');
        const btnContinue = document.getElementById('btn-continue-checkout');

        // DIBUJA LOS PRODUCTOS EN PANTALLA
        function renderizarCarritoPagina() {
            let carritoLocal = leerCarrito();
            cartListContainer.innerHTML = '';
            
            let totalItems = 0;
            let totalPrice = 0;
            const entries = Object.entries(carritoLocal);

            if (entries.length === 0) {
                cartListContainer.innerHTML = `
                    <div class="cart-vacio">
                        <h3>Tu carrito está vacío</h3>
                        <p>Agrega productos desde el catálogo.</p>
                        <a href="/" class="btn-ir-catalogo">Ir al catálogo</a>
                    </div>`;
                btnContinue.disabled = true;
                
            } else {
                btnContinue.disabled = false;
                
                
                entries.forEach(([id, item]) => {
                    // Extrae las propiedades admitiendo español e inglés
                    let nombre = item.nombre || item.name || item.titulo || "Producto Agro";
                    let precio = parseFloat(item.precio || item.price || 0);
                    let cantidad = parseInt(item.cantidad || item.qty || 1);
                    let imagen = item.imagen || item.img || "img/logoagroperu.jpg";

                    totalItems += cantidad;
                    totalPrice += (precio * cantidad);

                    cartListContainer.innerHTML += `
                        <div class="cart-item">
                            <div class="cart-item-info">
                                <img src="${imagen}" alt="${nombre}" onerror="this.src='img/logoagroperu.jpg'"> 
                                <div class="cart-item-details">
                                    
                                    <strong>${nombre}</strong>
                                    ${item.cantidadCaja ? `<span class="cart-item-meta">Caja: ${item.cantidadCaja} un. · Bolsa: ${item.cantidadBolsa == null ? 'No aplica' : item.cantidadBolsa + ' un.'}</span>` : ''}
                                </div>
                            </div>
                            
                            <div class="controls-wrapper">
                                <div class="item-price">S/ ${(precio * cantidad).toFixed(2)}</div>
                                
                                <div class="qty-controls">
                                    <button type="button" onclick="modificarCantidad('${id}', -1)" aria-label="Quitar uno">−</button>
                                    <label class="qty-campo"><input class="qty-input" type="number" inputmode="numeric" min="0" max="999" value="${cantidad}" aria-label="Cantidad" onchange="escribirCantidad('${id}', this)" onfocus="this.select()" onkeydown="if (event.key === 'Enter') this.blur()"><span>un</span></label>
                                    <button type="button" onclick="modificarCantidad('${id}', 1)" aria-label="Agregar uno">+</button>
                                </div>
                                
                                <button type="button" class="btn-delete" onclick="eliminarProducto('${id}')" title="Eliminar producto" aria-label="Eliminar producto"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18 M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6 M10 11v6 M14 11v6 M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></button>
                            </div>
                        </div>
                    `;
                });
            }

            // Actualiza montos y contadores
            cartTitleQty.textContent = totalItems;
            summaryQty.textContent = totalItems;
            summarySubtotal.textContent = `S/ ${totalPrice.toFixed(2)}`;
            summaryTotal.textContent = `S/ ${totalPrice.toFixed(2)}`;

            // El badge del header (🛒) lo actualiza app.js, así queda igual en toda la web
            if (typeof actualizarContadorCarrito === 'function') {
                actualizarContadorCarrito();
            }
        }

        // SUMA O RESTA CANTIDADES
        window.modificarCantidad = function(id, cambio) {
            let carritoLocal = leerCarrito();
            if (carritoLocal[id]) {
                let cantidadActual = carritoLocal[id].cantidad !== undefined ? carritoLocal[id].cantidad : (carritoLocal[id].qty !== undefined ? carritoLocal[id].qty : 1);
                let nuevaCantidad = cantidadActual + cambio;
                const stock = carritoLocal[id].stock;
                if (cambio > 0 && Number.isFinite(stock) && stock > 0 && nuevaCantidad > stock) {
                    AgroUI.toast(`Solo hay ${stock} unidades disponibles de este producto.`, 'warning', 'Stock limitado');
                    return;
                }

                if (nuevaCantidad <= 0) {
                    delete carritoLocal[id];
                } else {
                    if (carritoLocal[id].cantidad !== undefined) carritoLocal[id].cantidad = nuevaCantidad;
                    if (carritoLocal[id].qty !== undefined) carritoLocal[id].qty = nuevaCantidad;
                }

                guardarCarrito(carritoLocal);
                renderizarCarritoPagina();
            }
        };

                // CANTIDAD ESCRITA A MANO (0 = quitar del carrito)
        window.escribirCantidad = function(id, campo) {
            let carritoLocal = leerCarrito();
            const item = carritoLocal[id];
            if (!item) return;
            const leida = leerCantidadEscrita(campo.value, item.stock);
            if (!leida) {
                campo.value = String(item.qty ?? item.cantidad ?? 1);
                return;
            }
            if (leida.recortada) {
                AgroUI.toast(`Solo hay ${leida.recortada} unidades disponibles de este producto.`, 'warning', 'Stock limitado');
            }
            fijarCantidadCarrito(carritoLocal, id, leida.cantidad);
            guardarCarrito(carritoLocal);
            renderizarCarritoPagina();
        };

        // ELIMINA EL PRODUCTO COMPLETAMENTE
        window.eliminarProducto = function(id) {
            let carritoLocal = leerCarrito();
            if (carritoLocal[id]) {
                delete carritoLocal[id];
                guardarCarrito(carritoLocal);
                renderizarCarritoPagina();
            }
        };

        // CONTINUAR A LA ENTREGA / LOGIN
        btnContinue.addEventListener('click', () => {
            const sesionActiva = obtenerSesionSegura();
            if (sesionActiva) {
                irA('/checkout'); 
            } else {
                alert("Para continuar con tu compra, necesitas iniciar sesión.");
                irA('/login');
            }
        });

        alCargar(() => {
            renderizarCarritoPagina();
        });
    
}

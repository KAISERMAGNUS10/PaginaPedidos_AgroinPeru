// @ts-nocheck
import { Component, OnDestroy, ViewEncapsulation, afterNextRender } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ejecutarPagina, type Limpiador } from '../../../core/utils/navegacion';
import { alCargar, irA } from '../../../core/utils/navegacion';
import { obtenerSesionSegura } from '../../../core/utils/auth-storage';
import { guardarCarrito, leerCarrito } from '../../../core/utils/carrito-store';
import { actualizarContadorCarrito } from '../../../core/utils/layout-global';
import { iniciarGlobalPublico } from '../../../core/utils/layout-global';

@Component({
  selector: 'app-carrito',
  imports: [RouterLink],
  templateUrl: './carrito.html',
  styleUrls: ['../../../../styles/header.css', './carrito.css', '../../../../styles/ui-enhancements.css'],
  // Estilos de la página sin encapsulación y respetando los espacios del HTML.
  encapsulation: ViewEncapsulation.None,
  preserveWhitespaces: true,
  host: { style: 'display: contents' }
})
export class Carrito implements OnDestroy {
  private limpiar: Limpiador | null = null;

  constructor() {
    // La lógica necesita que el HTML ya esté en el DOM, por eso corre después del primer render (solo navegador).
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
    }
  }
}

// ==========================================================================
// LÓGICA DE LA PÁGINA
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
                    <div style="background: white; padding: 40px; text-align: center; border-radius: 8px; border: 1px solid #ddd;">
                        <h3 style="color:#666; margin:0;">Tu carro está vacío</h3>
                        <p style="color:#888; font-size:14px; margin-top:5px;">Agrega productos desde la tienda principal.</p>
                    </div>`;
                btnContinue.disabled = true;
                btnContinue.style.background = '#ccc';
                btnContinue.style.cursor = 'not-allowed';
            } else {
                btnContinue.disabled = false;
                btnContinue.style.background = '#00c853';
                btnContinue.style.cursor = 'pointer';
                
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
                                    <span class="seller-tag">✔ Vendido por <strong>AGROINPERU</strong></span>
                                    <strong>${nombre}</strong>
                                    ${item.cantidadCaja ? `<span class="cart-item-meta">Caja: ${item.cantidadCaja} un. · Bolsa: ${item.cantidadBolsa == null ? 'No aplica' : item.cantidadBolsa + ' un.'}</span>` : ''}
                                </div>
                            </div>
                            
                            <div class="controls-wrapper">
                                <div class="item-price">S/ ${(precio * cantidad).toFixed(2)}</div>
                                
                                <div class="qty-controls">
                                    <button type="button" onclick="modificarCantidad('${id}', -1)">-</button>
                                    <span>${cantidad} UN</span>
                                    <button type="button" onclick="modificarCantidad('${id}', 1)">+</button>
                                </div>
                                
                                <button type="button" class="btn-delete" onclick="eliminarProducto('${id}')" title="Eliminar producto">🗑️</button>
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

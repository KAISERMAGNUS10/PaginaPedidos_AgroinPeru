# AGROINPERU · Frontend (Angular 22)

Tienda web con recojo en tienda + panel interno (Administrador, Caja y Almacén).
Ya está **conectado al backend** (`../backend`): no usa datos guardados en el navegador, todo viene de la API y de PostgreSQL (Supabase).

## Dónde corre

Se publica en **Vercel** junto con la API (mismo dominio, la API en `/api`); los datos están en
**Supabase**. No se ejecuta en local: los pasos están en **[../DESPLIEGUE.md](../DESPLIEGUE.md)**.
Todas las páginas se generan como archivos estáticos al compilar (`npm run build`, lo hace Vercel).

## Cuentas de prueba

| Rol | Correo | Contraseña | Entra a |
|---|---|---|---|
| Administrador | admin@agroinperu.com | Admin1234 | `/admin` |
| Cajero | caja@agroinperu.com | Caja1234 | `/admin/caja` |
| Almacenero | picking@agroinperu.com | Picking1234 | `/admin/picking` |
| Cliente | cliente@agroinperu.com | Cliente1234 | tienda `/` |

Cada rol entra **solo a su módulo**. El administrador ya no usa caja ni almacén.

## Pantallas

**Tienda (cliente):** catálogo, producto, carrito (invitado o con sesión), checkout, ticket,
mis pedidos (cancelar, persona autorizada), notificaciones de "pedido listo".

**Administrador (`/admin`):** Dashboard · Ventas · Compras · Inventario · Reportes · Usuarios.
- *Usuarios*: crear, editar, cambiar rol, restablecer contraseña, bloquear/reactivar.
- *Inventario*: crear/editar productos, movimientos (entrada, salida, ajuste, traslado) y kardex.
- *Compras*: registrar compras a proveedores (suma stock) y anularlas (resta stock).
- *Ventas*: listado, detalle, impresión y exportación CSV.
- *Reportes*: ventas, compras, métodos de pago, productos más vendidos, clientes, inventario; CSV e impresión.

**Cajero (`/admin/caja`):** cola de pedidos listos, búsqueda por ticket/DNI/RUC, cobro en efectivo
(con vuelto y billetes rápidos), tarjeta o Yape/Plin, comprobante e historial de ventas.

**Almacenero (`/admin/picking`):** tarjetas de pedidos por preparar con checklist, pedidos por entregar
(con la persona autorizada) e historial de entregas.

## Estructura útil

```
src/app/
├── core/            config.ts (URL del API) · utils/api.ts (cliente HTTP + token) · guards · services
├── layouts/         public-layout (tienda) · admin-layout (panel con menú lateral por rol)
├── pages/           auth · public · client · admin/{dashboard,usuarios,inventario,ventas,compras,reportes,caja,picking}
├── shared/          componentes del panel (modal, iconos, gráficos, confirmación…)
└── models/
src/styles/panel.css  diseño del panel interno
```

# AGROINPERU · Frontend (Angular 22)

Tienda web con recojo en tienda + panel interno (Administrador, Caja, Almacén y Soporte).
Todo viene de la API (`/api`) y de la base PostgreSQL en Supabase.

## Dónde corre

Se publica en **Vercel** junto con la API, en el mismo dominio (la API en `/api`).
Al compilar (`npm run build`, lo hace Vercel) todas las páginas se generan como archivos estáticos.
La configuración de publicación está en `../vercel.json` y la del backend en `../backend/README.md`.

## Cuentas de prueba

| Rol | Correo | Contraseña | Entra a |
|---|---|---|---|
| Administrador | admin@agroinperu.com | Admin1234 | `/admin` |
| Cajero | caja@agroinperu.com | Caja1234 | `/admin/caja` |
| Almacenero | picking@agroinperu.com | Picking1234 | `/admin/picking` |
| Soporte | soporte@agroinperu.com | Soporte1234 | `/admin/soporte` |
| Cliente | cliente@agroinperu.com | Cliente1234 | tienda `/` |

Cada rol entra **solo a su módulo**.

## Pantallas

**Tienda (cliente):** catálogo, producto, carrito (invitado o con sesión), checkout, ticket,
mis pedidos (cancelar, persona autorizada), notificaciones de "pedido listo" y **Mi cuenta**
(datos y cambio de contraseña).

**Inicio de sesión:** "¿Olvidaste tu contraseña?" envía correo + documento al área de soporte.

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

**Soporte (`/admin/soporte`):** solicitudes de recuperación de contraseña. Restablece a la temporal
`12345678` (el usuario debe cambiarla al entrar) o rechaza la solicitud.

## Estructura

```
src/app/
├── core/            config.ts (ruta de la API) · utils/api.ts (cliente HTTP + token) · guards · services
├── layouts/         public-layout (tienda) · admin-layout (panel con menú lateral por rol)
├── pages/           auth · public · client · admin/{dashboard,usuarios,inventario,ventas,compras,reportes,caja,picking,soporte}
├── shared/          componentes del panel (modal, iconos, gráficos, confirmación…)
└── models/
src/styles/panel.css  diseño del panel interno
```

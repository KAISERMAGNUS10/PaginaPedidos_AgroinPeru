# AGROINPERU · Frontend (Angular 22)

Tienda web con recojo en tienda + panel interno (Administrador, Caja y Almacén).
Ya está **conectado al backend** (`../backend`): no usa datos guardados en el navegador, todo viene de la API y de MySQL.

## Cómo ejecutarlo

Necesitas **dos terminales** (primero el backend):

```bash
# Terminal 1
cd backend
npm install        # solo la primera vez
npm run seed       # solo la primera vez (carga productos y cuentas de prueba)
npm run dev

# Terminal 2
cd frontend
npm install        # solo la primera vez
npm start
```

Abre **http://localhost:4200**. (Angular 22 pide Node.js 22.22.3 o superior.)

Si cambias el puerto del backend (`PORT` en `backend/.env`), cámbialo también en
`src/app/core/config.ts` (`API_URL`).

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

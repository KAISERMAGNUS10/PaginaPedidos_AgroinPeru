# Backend – AGROINPERU Pedidos (recojo en tienda)

API REST en **Node.js + Express 5 + TypeScript + MySQL**, con la misma arquitectura en capas
del proyecto `Agroinperu-main`:

```
backend/
├── .env  .env.example  .gitignore  package.json  tsconfig.json
├── database/db_pedidosagroinperu.sql      ← tu script de la BD (codigo_sku ampliado a 80)
└── src/
    ├── server.ts  app.ts
    ├── config/        database.ts · cors.ts · env.ts
    ├── middlewares/   auth · error · not-found
    ├── models/        tipos TypeScript (forma = la que ya usa tu frontend)
    ├── repositories/  SQL (mysql2)
    ├── services/      reglas de negocio
    ├── controllers/   HTTP
    ├── routes/        endpoints
    ├── utils/         validadores, fechas, errores
    └── scripts/       seed.ts + data/catalogo.json (los 401 productos del frontend)
```

## Paso a paso

1. **Base de datos** (si aún no lo hiciste): en MySQL Workbench abre
   `database/db_pedidosagroinperu.sql`, ejecútalo todo (Ctrl+Shift+Enter) y refresca los esquemas.
2. **Copiar**: descomprime el zip para que `backend` quede junto a `Frontend`:
   ```
   PaginaPedidos_AgroinPeru/
   ├── Frontend/
   └── backend/      ← aquí
   ```
3. **Revisa `.env`** (ya viene con tus datos: `DB_PASSWORD=12345`, puerto 3000, frontend `http://localhost:4200`).
4. **Instalar y sembrar datos** (en una terminal, dentro de `backend`):
   ```bash
   npm install
   npm run seed      # carga 11 categorías, 401 productos y las cuentas de prueba
   npm run dev       # arranca en http://localhost:3000
   ```
5. **Probar**: abre <http://localhost:3000/api/health> → debe responder `success: true`
   y <http://localhost:3000/api/public/productos> → lista de 401 productos.

Producción: `npm run build` y luego `npm start`.

## Cuentas de prueba (las crea `npm run seed`)

| Rol     | Correo                  | Contraseña   |
|---------|-------------------------|--------------|
| ADMIN   | admin@agroinperu.com    | Admin1234    |
| CAJA    | caja@agroinperu.com     | Caja1234     |
| PICKING | picking@agroinperu.com  | Picking1234  |
| CLIENTE | cliente@agroinperu.com  | Cliente1234  |

`npm run seed` se puede repetir sin problema: no duplica datos ni pisa el stock.

## Qué hace el servidor al arrancar (automático)

- Agrega `tbl_pedidos.fecha_cancelacion` y `tbl_notificaciones.mostrado_toast` si no existen.
- Amplía `tbl_productos.codigo_sku` a `VARCHAR(80)` (hay SKU del catálogo de hasta 57 caracteres).
- Garantiza los roles ADMIN / CAJA / PICKING / CLIENTE y una tienda de recojo.
- Cada 5 min pasa a **EXPIRADO** los pedidos de más de 48 h y **devuelve su stock**.

## Endpoints

Todas las respuestas: `{ success, message, data }`. Errores: `{ success:false, code, message }`.
Rutas protegidas: header `Authorization: Bearer <token>`. **ADMIN** puede entrar a todos los módulos de personal.

### Público
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/health` | Estado de la API |
| GET | `/api/public/productos?categoria=&q=` | Catálogo (misma forma que `ProductoCatalogo`; `id` = SKU) |
| GET | `/api/public/productos/:sku` | Detalle |
| GET | `/api/public/categorias` | Categorías con cantidad |
| GET | `/api/public/tiendas` | Tiendas de recojo |

### Auth
| POST | `/api/auth/registro` | `{nombre, apellidos, correo, password, documentoTipo, documentoNumero, celular}` → `{token, usuario}` |
|---|---|---|
| POST | `/api/auth/login` | `{email, password}` → `{token, usuario:{Nombre,Apellidos,Correo,Rol,...}}` |
| GET | `/api/auth/me` | Sesión actual |

### Cliente (rol CLIENTE)
| Método | Ruta | Descripción |
|---|---|---|
| GET / DELETE | `/api/carrito` | Ver / vaciar carrito |
| POST | `/api/carrito/items` | `{id, cantidad}` suma al carrito |
| PUT / DELETE | `/api/carrito/items/:sku` | Fijar cantidad / quitar |
| PUT | `/api/carrito` | `{items:[{id,qty}]}` reemplaza (sube el carrito de localStorage) |
| POST | `/api/pedidos` | **Checkout**: `{tipoComprobante, nombreFacturacion, documentoTipo, documentoNumero, correo, telefono, items?}` → ticket |
| GET | `/api/pedidos/mis-pedidos` | Mis tickets |
| GET | `/api/pedidos/:codigo` | Un ticket (cliente: solo el suyo; personal: cualquiera) |
| PATCH | `/api/pedidos/:codigo/cancelar` | Solo VIGENTE y < 24 h; devuelve stock |
| PUT / DELETE | `/api/pedidos/:codigo/persona-autorizada` | `{nombre, dni}` / quitar |
| GET | `/api/notificaciones` | Notificaciones |
| PATCH | `/api/notificaciones/leidas` · `/:id/leida` · `/toast-mostrado` | Marcar |

### Caja (CAJA / ADMIN)
| GET | `/api/caja/buscar?q=` | Por N° de ticket o DNI/RUC → lista de tickets |
|---|---|---|
| POST | `/api/caja/pedidos/:codigo/pagar` | `{metodoPago:'Efectivo'\|'Tarjeta'\|'Yape/Plin', montoRecibido?, numOperacion?}` |
| GET | `/api/caja/ventas?desde=&hasta=` | Ventas (fechas `YYYY-MM-DD`) |
| GET | `/api/caja/ventas/:codigo` | Detalle de venta |

### Picking (PICKING / ADMIN)
| GET | `/api/picking/pendientes` | Pedidos VIGENTES (más antiguo primero) |
|---|---|---|
| GET | `/api/picking/por-entregar` | Pedidos PAGADOS |
| GET | `/api/picking/historial?desde=&hasta=` | Entregados |
| PATCH | `/api/picking/pedidos/:codigo/progreso` | `{items}` (opcional) |
| POST | `/api/picking/pedidos/:codigo/listo` | VIGENTE → LISTO_PARA_RECOJO (+ notifica al cliente) |
| POST | `/api/picking/pedidos/:codigo/entregar` | PAGADO → ENTREGADO |

### Caja (extra)
| GET | `/api/caja/pendientes` | Cola de cobro: pedidos LISTO_PARA_RECOJO |
|---|---|---|

### Admin (solo ADMIN)
| GET | `/api/dashboard?desde=&hasta=` | KPIs, estados, ventas 7 días, actividad, inventario, compras, clientes |
|---|---|---|
| POST | `/api/dashboard/reiniciar-demo` | `{confirmar:true}` borra pedidos/pagos/carritos y devuelve el stock |
| GET | `/api/inventario?q=&bajoMinimo=true` | Stock y datos de cada producto |
| POST / PUT | `/api/inventario/productos` · `/productos/:sku` | Crear / editar producto |
| GET / POST | `/api/inventario/movimientos` | Kardex / registrar ENTRADA, SALIDA, AJUSTE, TRASLADO |
| GET / POST | `/api/compras` | Listar (filtros) / registrar compra (suma stock) |
| GET | `/api/compras/:codigo` | Detalle de compra |
| PATCH | `/api/compras/:codigo/anular` | Anula la compra y resta el stock |
| GET | `/api/reportes?desde=&hasta=` | Ventas, compras, métodos de pago, top productos/clientes, inventario |
| GET / POST | `/api/usuarios` | Listar / crear usuario (cualquier rol) |
| PUT | `/api/usuarios/:id` | Editar datos, rol, estado o restablecer contraseña |
| PATCH | `/api/usuarios/:id/estado` | ACTIVO / INACTIVO / BLOQUEADO |

## Flujo de un pedido

`VIGENTE` (checkout, reserva stock) → Picking **listo** → `LISTO_PARA_RECOJO` (notifica) →
Caja **paga** → `PAGADO` → Picking **entrega** → `ENTREGADO`.
Salidas: `CANCELADO` (cliente, < 24 h) o `EXPIRADO` (48 h); ambas devuelven el stock.
Todo movimiento de stock queda registrado en `tbl_movimientos_inventario` (kardex).

## Reglas importantes

- Precios con IGV incluido: `subtotal = total / 1.18`, `igv = total - subtotal`.
- Tickets: `TK-2026-00001` (correlativo por año). Comprobantes: `B001-00000001` / `F001-00000001`.
- Boleta → DNI o CE; Factura → RUC. Mismas validaciones que el frontend.
- Fechas en ISO (UTC); los filtros `desde/hasta` se interpretan en hora de Perú (UTC-5).

## Frontend

El frontend (`../frontend`) ya está conectado a esta API. Se ejecuta con `npm start` en
`http://localhost:4200` (ver el README del frontend). Para que el navegador pueda llamar a la API,
`FRONTEND_URL` en `.env` debe ser exactamente `http://localhost:4200`.

## Compras (tablas nuevas)

Al arrancar, el servidor crea solo `tbl_compras` y `tbl_detalle_compras` (no estaban en tu script).
Registrar una compra suma stock (movimiento ENTRADA en el kardex); anularla lo resta, siempre que
todavía haya stock suficiente en la ubicación de destino.

## Problemas frecuentes

- `ER_ACCESS_DENIED_ERROR` → la contraseña de `DB_PASSWORD` no coincide con tu MySQL.
- `ER_BAD_DB_ERROR` → falta ejecutar el script SQL (paso 1).
- `ECONNREFUSED` → MySQL no está iniciado.
- `Origen no permitido` → el frontend no corre en `FRONTEND_URL` (puedes poner varios separados por coma).
- Puerto 3000 ocupado → cambia `PORT` en `.env`.

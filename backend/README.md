# Backend – AGROINPERU Pedidos (recojo en tienda)

API REST en **Node.js + Express 5 + TypeScript + PostgreSQL (Supabase)**, lista para publicarse en **Vercel**.

```
backend/
├── .env  .env.example  .gitignore  package.json  tsconfig.json
├── database/agroinperu_postgresql.sql   ← tablas + vistas + datos de prueba (pegar en Supabase)
└── src/
    ├── app.ts              ← la app Express (Vercel la usa directamente)
    ├── servidor-local.ts   ← arranca la API en tu PC (npm run dev)
    ├── config/        database.ts (pg + Supabase) · cors.ts · env.ts
    ├── middlewares/   auth · error · not-found
    ├── models/        tipos TypeScript (forma = la que ya usa tu frontend)
    ├── repositories/  SQL (PostgreSQL)
    ├── services/      reglas de negocio
    ├── controllers/   HTTP
    ├── routes/        endpoints
    ├── utils/         validadores, fechas, errores
    └── scripts/       seed.ts (ejecuta el .sql contra DATABASE_URL)
```

Para publicarlo (Supabase + Vercel) sigue **[../DESPLIEGUE.md](../DESPLIEGUE.md)**.

## Uso local

1. **Base de datos**: crea el proyecto en Supabase y ejecuta `database/agroinperu_postgresql.sql`
   en el SQL Editor (o, ya con `DATABASE_URL` configurada, `npm run seed`, que hace lo mismo).
2. **`.env`**: copia `.env.example` a `.env` y completa `DATABASE_URL` (Supabase → **Connect** →
   **Transaction pooler**) y `JWT_SECRET`.
3. **Instalar y arrancar** (dentro de `backend`):
   ```bash
   npm install
   npm run dev       # http://localhost:3000
   ```
4. **Probar**: <http://localhost:3000/api/health> → `success: true`
   y <http://localhost:3000/api/public/productos> → 401 productos.

⚠ `npm run seed` **borra y vuelve a crear** todas las tablas con los datos de prueba.

## Variables de entorno

| Variable | Ejemplo | Para qué |
|---|---|---|
| `DATABASE_URL` | `postgresql://postgres.xxxx:CLAVE@aws-0-….pooler.supabase.com:6543/postgres` | Conexión a Supabase |
| `JWT_SECRET` | una frase larga y aleatoria | Firma de los tokens de sesión |
| `JWT_EXPIRES_IN` | `2h` | Duración de la sesión |
| `FRONTEND_URL` | `http://localhost:4200,https://agroinperu.vercel.app` | Orígenes permitidos (CORS), separados por coma |
| `PORT` | `3000` | Solo local |

## Cuentas de prueba (vienen en el script SQL)

| Rol     | Correo                  | Contraseña   |
|---------|-------------------------|--------------|
| ADMIN   | admin@agroinperu.com    | Admin1234    |
| CAJA    | caja@agroinperu.com     | Caja1234     |
| PICKING | picking@agroinperu.com  | Picking1234  |
| CLIENTE | cliente@agroinperu.com  | Cliente1234  |

## Expiración de pedidos

Los pedidos de más de 48 h pasan a **EXPIRADO** y **devuelven su stock**. No depende de un
temporizador: cada consulta de caja, picking, pedidos, dashboard y reportes revisa los vencidos
antes de responder (así funciona igual en Vercel). En local, además, se revisa cada 5 min.

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

El frontend (`../frontend`) ya está conectado a esta API. La URL se elige sola en
`frontend/src/app/core/config.ts`: en `localhost` usa `http://localhost:3000/api` y publicado usa
`API_PRODUCCION` (la URL de este backend en Vercel). Cada URL desde donde se abra el frontend
debe estar en `FRONTEND_URL`.

## Compras

Registrar una compra suma stock (movimiento ENTRADA en el kardex); anularla lo resta, siempre que
todavía haya stock suficiente en la ubicación de destino.

## Problemas frecuentes

- `Falta la variable de entorno DATABASE_URL` → no está en `.env` (local) o en Vercel → Settings → Environment Variables.
- `password authentication failed` → la contraseña dentro de `DATABASE_URL` no es la de tu base de Supabase.
- `relation "tbl_..." does not exist` → falta ejecutar `database/agroinperu_postgresql.sql` en Supabase.
- `Origen no permitido` (403) → la URL del frontend no está en `FRONTEND_URL`.
- Puerto 3000 ocupado (local) → cambia `PORT` en `.env` y `API_LOCAL` en el frontend.

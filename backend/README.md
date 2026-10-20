# Backend – AGROINPERU Pedidos (recojo en tienda)

API REST en **Express 5 + TypeScript**, publicada en **Vercel** como `/api` (mismo dominio que la
página) y conectada a **PostgreSQL en Supabase**.

```
vercel.json                  ← (raíz del repo) compila el frontend y envía /api/* a la función
api/index.ts                 ← (raíz del repo) función de Vercel: entrega cada /api/* a src/app.ts
backend/
├── database/agroinperu_postgresql.sql   ← script completo: 16 tablas, 3 vistas y datos de prueba
└── src/
    ├── app.ts         ← la app Express con todas las rutas
    ├── config/        database.ts (conexión a Supabase con pg)
    ├── middlewares/   auth · error · not-found
    ├── models/        tipos TypeScript (forma = la que ya usa el frontend)
    ├── repositories/  SQL (PostgreSQL)
    ├── services/      reglas de negocio
    ├── controllers/   HTTP
    ├── routes/        endpoints
    └── utils/         validadores, fechas, errores
```

## Publicación

Un solo proyecto en Vercel, creado desde este repositorio con **Root Directory vacío** (la raíz) y
Framework **Other**; el resto lo lee de `vercel.json`. Cada `git push` a `main` vuelve a publicar.

`database/agroinperu_postgresql.sql` crea la base desde cero (Supabase → SQL Editor → Run).
⚠ Borra y vuelve a crear todas las tablas: no ejecutarlo sobre la base que ya está en uso.

Supabase pausa los proyectos gratuitos tras **7 días sin uso**: antes de una exposición, abre la
página o, si aparece pausado, pulsa **Restore project** en Supabase.

## Variables de entorno (Vercel → Settings → Environment Variables)

| Variable | Ejemplo | Para qué |
|---|---|---|
| `DATABASE_URL` | `postgresql://postgres.xxxx:CLAVE@aws-0-….pooler.supabase.com:6543/postgres` | Conexión a Supabase (Transaction pooler) |
| `JWT_SECRET` | una frase larga y aleatoria | Firma de los tokens de sesión |
| `JWT_EXPIRES_IN` | `8h` | Duración de la sesión (por defecto `2h`) |

## Cuentas de prueba (vienen en el script SQL)

| Rol     | Correo                  | Contraseña   |
|---------|-------------------------|--------------|
| ADMIN   | admin@agroinperu.com    | Admin1234    |
| CAJA    | caja@agroinperu.com     | Caja1234     |
| PICKING | picking@agroinperu.com  | Picking1234  |
| SOPORTE | soporte@agroinperu.com  | Soporte1234  |
| CLIENTE | cliente@agroinperu.com  | Cliente1234  |

## Expiración de pedidos

Los pedidos de más de 48 h pasan a **EXPIRADO** y **devuelven su stock**. No depende de un
temporizador: cada consulta de caja, picking, pedidos, dashboard y reportes revisa los vencidos
antes de responder.

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
| PUT | `/api/auth/password` | `{actual, nueva}` cambia la propia contraseña |
| POST | `/api/auth/recuperar` | `{correo, documentoNumero}` deja una solicitud para soporte (respuesta siempre igual) |

### Soporte (SOPORTE / ADMIN)
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/soporte/solicitudes?estado=` | Solicitudes de recuperación (PENDIENTE, ATENDIDA, RECHAZADA) |
| POST | `/api/soporte/solicitudes/:id/restablecer` | Pone la contraseña temporal `12345678` y obliga a cambiarla al entrar |
| POST | `/api/soporte/solicitudes/:id/rechazar` | `{motivo}` cierra la solicitud sin cambios |

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

El frontend (`../frontend`) llama a la API en el mismo dominio (`/api`, ver
`frontend/src/app/core/config.ts`), así que no hay URLs ni CORS que configurar.

## Compras

Registrar una compra suma stock (movimiento ENTRADA en el kardex); anularla lo resta, siempre que
todavía haya stock suficiente en la ubicación de destino.

## Problemas frecuentes

Los errores de la API se ven en Vercel → el proyecto → **Logs**.

| Síntoma | Causa / solución |
|---|---|
| "No se pudo conectar con el servidor" | Abre `/api/health`. Si falla, revisa el despliegue en Vercel → **Logs**. |
| `/api/health` funciona pero los productos dan error 500 | `DATABASE_URL` mal copiada (contraseña o puerto 6543): corrígela y haz **Redeploy**. |
| Error 500 "Falta la variable de entorno DATABASE_URL" | Falta la variable o se agregó después del deploy: haz **Redeploy**. |
| No se puede iniciar sesión (error 500) | Falta `JWT_SECRET`: agrégala y haz **Redeploy**. |
| La página no carga datos tras días sin uso | Supabase pausó el proyecto: **Restore project**. |

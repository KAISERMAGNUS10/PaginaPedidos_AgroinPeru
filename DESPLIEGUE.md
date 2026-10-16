# Despliegue: Vercel (página + API) y Supabase (base de datos)

Todo corre en internet; no hay que encender nada en una PC.

```
Navegador ──► https://<proyecto>.vercel.app        (frontend Angular, estático)
          └─► https://<proyecto>.vercel.app/api/*  (API Express, función de Vercel) ──► PostgreSQL en Supabase
```

Es **un solo proyecto en Vercel**, creado desde el repositorio
`KAISERMAGNUS10/PaginaPedidos_AgroinPeru`. La configuración ya está en `vercel.json` (raíz):
compila el frontend, publica la API en `/api` y ambos quedan en el mismo dominio.

---

## 1. Supabase (✅ ya hecho)

Las tablas y los datos ya están cargados (`backend/database/agroinperu_postgresql.sql`).
Solo falta copiar la **cadena de conexión**:

1. Supabase → tu proyecto → botón **Connect** (arriba).
2. Pestaña **Connection string** → **Transaction pooler** (puerto **6543**).
3. Copia la URI y reemplaza `[YOUR-PASSWORD]` por la contraseña de la base de datos:
   ```
   postgresql://postgres.abcdefghijk:TU_CLAVE@aws-0-sa-east-1.pooler.supabase.com:6543/postgres
   ```
   > Si no recuerdas la contraseña o tiene símbolos como `@ # / ?`: Project Settings → Database →
   > **Reset database password** y elige una solo con letras y números.

## 2. Vercel: crear el proyecto

1. <https://vercel.com> → **Add New… → Project** → importa `PaginaPedidos_AgroinPeru`.
2. **Root Directory**: déjalo vacío (la raíz del repositorio). **Framework Preset**: *Other*.
   No cambies Build/Output/Install: se leen de `vercel.json`.
3. **Environment Variables**:

   | Nombre | Valor |
   |---|---|
   | `DATABASE_URL` | la URI del paso 1 |
   | `JWT_SECRET` | una frase larga y aleatoria (no la compartas) |
   | `JWT_EXPIRES_IN` | `8h` |

4. **Deploy**. Cuando termine, abre el dominio que te da Vercel (p. ej. `https://agroinperu.vercel.app`).

> Si el proyecto ya existía con otra configuración (Root Directory `backend` o `frontend`):
> Settings → Build and Deployment → Root Directory vacío y Framework *Other*; luego Redeploy.

## 3. Comprobar

- `https://TU-PROYECTO.vercel.app/api/health` → `"success": true`
- `https://TU-PROYECTO.vercel.app/api/public/productos` → lista de productos (la API sí llega a Supabase)
- `https://TU-PROYECTO.vercel.app` → la tienda. Entra con estas cuentas:

| Rol | Correo | Contraseña |
|---|---|---|
| Administrador | admin@agroinperu.com | Admin1234 |
| Cajero | caja@agroinperu.com | Caja1234 |
| Almacén | picking@agroinperu.com | Picking1234 |
| Cliente | cliente@agroinperu.com | Cliente1234 |

Cada `git push` a `main` vuelve a publicar todo automáticamente.

## Antes de la exposición

Supabase pausa los proyectos gratuitos tras **7 días sin uso**. Uno o dos días antes, abre la
página y navega un poco (o entra a Supabase y, si aparece pausado, pulsa **Restore project**).

## Problemas frecuentes

| Síntoma | Causa / solución |
|---|---|
| La página dice "No se pudo conectar con el servidor" | Abre `/api/health`. Si falla, revisa el despliegue en Vercel → **Logs**. |
| `/api/health` funciona pero `/api/public/productos` da error 500 | `DATABASE_URL` mal copiada (contraseña o puerto 6543). Corrígela en Settings → Environment Variables y haz **Redeploy**. |
| Error 500 "Falta la variable de entorno DATABASE_URL" | No se agregó la variable, o se agregó después del deploy: haz **Redeploy**. |
| No se puede iniciar sesión (error 500) | Falta `JWT_SECRET`. Agrégala y haz **Redeploy**. |

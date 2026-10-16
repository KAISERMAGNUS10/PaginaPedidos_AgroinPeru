# Despliegue: Supabase (base de datos) + Vercel (backend y frontend)

El orden importa: **primero la base de datos**, luego el **backend** (necesita la base) y al
final el **frontend** (necesita la URL del backend).

```
Navegador ──► Frontend (Vercel, estático) ──► Backend /api (Vercel, Express) ──► PostgreSQL (Supabase)
```

Se crean **dos proyectos en Vercel** desde el mismo repositorio de GitHub
(`KAISERMAGNUS10/PaginaPedidos_AgroinPeru`): uno con carpeta raíz `backend` y otro con `frontend`.

---

## 0. Subir los cambios a GitHub

```bash
git add -A
git commit -m "Migrar backend a PostgreSQL (Supabase) y preparar Vercel"
git push
```

## 1. Supabase: crear la base de datos

1. Entra a <https://supabase.com> → **New project**. Elige un nombre, una **contraseña de base de
   datos** (guárdala, la usarás en el paso 1.4) y la región **más cercana** (p. ej. *South America (São Paulo)*
   o *East US*).
2. Cuando termine de crearse: menú izquierdo → **SQL Editor** → **New query**.
3. Abre `backend/database/agroinperu_postgresql.sql`, copia **todo**, pégalo y presiona **Run**.
   Debe terminar en *Success*. En **Table Editor** verás 15 tablas (`tbl_productos` con 401 filas).
   > Si Supabase muestra un aviso de "operación destructiva" es por los `DROP TABLE IF EXISTS`
   > del inicio (sirven para poder re-ejecutarlo): confirma.
4. Botón **Connect** (arriba) → pestaña **Connection string** → **Transaction pooler** (puerto **6543**).
   Copia la URI y reemplaza `[YOUR-PASSWORD]` por tu contraseña. Ese texto es tu `DATABASE_URL`:
   ```
   postgresql://postgres.abcdefghijk:TU_CLAVE@aws-0-sa-east-1.pooler.supabase.com:6543/postgres
   ```
   > Si tu contraseña tiene símbolos como `@ # / ?`, cámbiala por una solo con letras y números
   > (Project Settings → Database → Reset password) para evitar errores en la URL.

## 2. Vercel: publicar el backend

1. <https://vercel.com> → **Add New… → Project** → importa el repositorio de GitHub.
2. **Root Directory**: `backend`. **Framework Preset**: *Express* (lo detecta solo).
3. **Environment Variables** (agrega las cuatro):

   | Nombre | Valor |
   |---|---|
   | `DATABASE_URL` | la URI del paso 1.4 |
   | `JWT_SECRET` | una frase larga y aleatoria (no la compartas) |
   | `JWT_EXPIRES_IN` | `2h` |
   | `FRONTEND_URL` | `http://localhost:4200` (en el paso 4 agregas la URL real) |

4. **Deploy**. Al terminar, copia el dominio, por ejemplo `https://agroinperu-api.vercel.app`.
5. Prueba en el navegador:
   - `https://TU-BACKEND.vercel.app/api/health` → `"success": true`
   - `https://TU-BACKEND.vercel.app/api/public/productos` → lista de productos (si responde, la conexión a Supabase funciona).

## 3. Apuntar el frontend al backend publicado

En `frontend/src/app/core/config.ts` cambia **solo** esta línea por tu dominio del paso 2.4:

```ts
const API_PRODUCCION = 'https://TU-BACKEND.vercel.app/api';
```

(En `localhost` el frontend sigue usando `http://localhost:3000/api` automáticamente.) Luego:

```bash
git add frontend/src/app/core/config.ts
git commit -m "URL del backend en producción"
git push
```

## 4. Vercel: publicar el frontend

1. Vercel → **Add New… → Project** → el **mismo** repositorio otra vez.
2. **Root Directory**: `frontend`. El resto lo toma de `frontend/vercel.json`
   (compila con `npm run build` y publica `dist/Frontend/browser`). No necesita variables.
3. **Deploy** y copia el dominio, por ejemplo `https://agroinperu.vercel.app`.
4. Vuelve al proyecto **backend** → Settings → Environment Variables → edita `FRONTEND_URL`:
   ```
   http://localhost:4200,https://agroinperu.vercel.app
   ```
   Luego **Deployments → ⋯ → Redeploy** (las variables solo se aplican en un nuevo despliegue).

## 5. Probar todo

Abre la URL del frontend, entra con `cliente@agroinperu.com` / `Cliente1234`, agrega productos al
carrito y genera un pedido. Después entra como `caja@…`, `picking@…` y `admin@…` (contraseñas en
`backend/README.md`).

Cada `git push` vuelve a desplegar ambos proyectos automáticamente.

## Problemas frecuentes

| Síntoma | Causa / solución |
|---|---|
| El frontend dice "No se pudo conectar con el servidor" | `API_PRODUCCION` mal escrita (paso 3) o el backend no responde a `/api/health`. |
| Error 403 "Origen no permitido" | La URL del frontend no está en `FRONTEND_URL` del backend, o no hiciste Redeploy (paso 4.4). |
| `/api/health` funciona pero `/api/public/productos` da error 500 | Revisa `DATABASE_URL` (contraseña, puerto 6543). En Vercel: proyecto backend → **Logs**. |
| `relation "tbl_productos" does not exist` | No se ejecutó el script SQL en Supabase (paso 1.3). |
| Supabase pausó el proyecto | Los proyectos gratis se pausan tras ~1 semana sin uso: Supabase → **Restore project**. |

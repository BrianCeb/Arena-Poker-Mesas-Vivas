# Arena Poker — Mesas Vivas

Sistema propio de gestión de mesas vivas (cash game) para Arena Poker.
Incluye backend (API) y frontend (jugador), como dos proyectos independientes
dentro de este mismo repositorio.

## Estructura

```
mesas-vivas-backend/    API en Node.js + Express + TypeScript + PostgreSQL (Prisma)
mesas-vivas-frontend/   Frontend en React + Vite
```

Cada carpeta tiene su propio `package.json`, se instala y se corre por separado.
No es necesario levantar ambos desde el mismo lugar — son dos servicios distintos
que se despliegan de forma independiente.

## Backend (`mesas-vivas-backend/`)

**Requiere:** Node.js 20+, una base de datos PostgreSQL (16 o superior), una
cuenta de [Resend](https://resend.com) para el envío de emails.

**Variables de entorno** (`.env`, ver `.env.example` con el detalle de cada una):

| Variable | Qué es |
|---|---|
| `DATABASE_URL` | Cadena de conexión a PostgreSQL |
| `PORT` | Puerto donde escucha la API (default 3000) |
| `RESEND_API_KEY` | Clave de la cuenta de Resend |
| `BACKEND_BASE_URL` | URL pública del backend (se usa para armar los links de los emails de verificación/recuperación) |
| `EMAIL_FROM` | Dirección remitente de los emails — requiere un dominio verificado en Resend para producción (con el dominio de prueba de Resend solo se puede mandar a la cuenta dueña de la API key) |
| `JWT_SECRET` | Clave para firmar los tokens de sesión — generar una nueva y aleatoria para producción, nunca reusar la de desarrollo |

**Setup:**
```bash
cd mesas-vivas-backend
npm install
npx prisma migrate deploy   # aplica las migraciones sobre la base de producción
npx prisma generate
npm run build
npm start
```

`npm run seed` (una sola vez, si la base está vacía) carga los roles base
(`OPERADOR`, `SUPERVISOR`, `ADMIN`) y una versión placeholder de Términos y
Condiciones — **importante:** el seed también le asigna el rol `ADMIN` a un
email hardcodeado en `prisma/seed.ts` (el de Brian, para desarrollo). Antes de
correrlo en producción, hay que cambiar ese email por el del usuario admin real,
o comentar esa parte y asignar el rol a mano después.

## Frontend (`mesas-vivas-frontend/`)

**Requiere:** Node.js 20+.

La URL del backend está hardcodeada en `src/api.ts` (`http://localhost:3000`)
— antes de desplegar a producción, hay que cambiarla a la URL pública real del
backend ya desplegado.

**Setup:**
```bash
cd mesas-vivas-frontend
npm install
npm run build
```
Esto genera una carpeta `dist/` con archivos estáticos listos para servir
desde cualquier hosting de contenido estático (Vercel, Netlify, S3+CloudFront,
un Nginx, etc.).

## Estado del proyecto

En desarrollo activo. Ver `mesas-vivas-backend/CLAUDE.md` para el detalle de
las decisiones de arquitectura, el modelo de datos, y qué fases del roadmap
están completas.

**Lo que falta antes de un primer despliegue real:**
- Definir dominio y hosting (backend y frontend).
- Verificar un dominio propio en Resend (hoy usa el dominio de prueba, con
  límite de envío).
- Reemplazar el email hardcodeado del seed por el admin real.
- Pantalla de registro en el frontend (hoy el registro se hace solo contra la API).
- Tiempo real con WebSockets (hoy el frontend actualiza por polling cada 4s).
- Panel administrativo en el frontend (hoy solo existe la vista de jugador).

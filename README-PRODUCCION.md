# Arena Poker — Guía de puesta en producción

Esta guía explica cómo llevar el sistema (backend + frontend) a un servidor real, paso a paso, sin asumir conocimiento previo del proyecto. Está pensada para quien tenga que instalarlo o reinstalarlo en el servidor, con acceso a la base de datos y a la terminal.

## Qué es este sistema

Una aplicación web para gestionar mesas de poker en vivo, listas de espera y torneos. Tiene dos partes:

- **Backend**: API en Node.js (TypeScript, Express), con una base de datos MySQL/MariaDB, que además envía emails (verificación de cuenta, recuperación de contraseña) y actualiza datos en tiempo real (Socket.IO).
- **Frontend**: aplicación web (React), pensada para usarse desde el celular, que habla con el backend.

Ambas partes se despliegan por separado: el backend corre como un proceso de Node.js corriendo todo el tiempo; el frontend se compila a archivos estáticos (HTML/CSS/JS) que se sirven desde un servidor web.

---

## 1. Requisitos previos

- **Node.js** versión 18 o superior (recomendado: la última LTS).
- **MySQL o MariaDB** (probado contra MariaDB 10.5), con una base de datos ya creada y un usuario con permisos sobre ella.
- **Acceso HTTPS** en el dominio donde va a vivir la aplicación — es obligatorio, no opcional: sin HTTPS, la app no funciona como PWA (no se puede instalar en el celular ni funciona offline) y algunas funciones de seguridad del navegador no operan.
- Un **gestor de procesos** para mantener el backend corriendo (se recomienda `pm2`, es el más simple).
- Un **servidor web / reverse proxy** para servir el frontend y redirigir las peticiones de la API (se recomienda `nginx`).

---

## 2. Backend

### 2.1. Copiar el código y las dependencias

```bash
cd /ruta/donde/va/el/backend
git clone <repositorio> .   # o copiar los archivos como corresponda
npm install
```

### 2.2. Configurar las variables de entorno

Copiar `.env.example` a `.env`:

```bash
cp .env.example .env
```

Y completar cada valor. Los más importantes:

| Variable | Qué va ahí |
|---|---|
| `DATABASE_URL` | Cadena de conexión a la base de datos MySQL real de producción (no la de pruebas). |
| `JWT_SECRET` | Un string aleatorio largo, distinto al de desarrollo. Generar uno con: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` | Datos del servidor de correo que va a mandar los emails de verificación y recuperación de contraseña. |
| `TURNSTILE_SECRET_KEY` | La clave secreta del captcha (Cloudflare Turnstile) — se saca del dashboard de Cloudflare. |
| `BACKEND_BASE_URL` | La URL pública real del backend, con `https://`. Se usa para armar los links que van dentro de los emails. |
| `FRONTEND_ORIGIN` | El dominio real donde se sirve el frontend, con `https://`. Controla qué orígenes puede aceptar la API (CORS) — sin esto bien configurado, el navegador va a bloquear los pedidos del frontend al backend. |

### 2.3. Aplicar la base de datos

Esto crea todas las tablas necesarias en la base de datos real, a partir de las migraciones ya generadas (sin generar ninguna nueva):

```bash
npx prisma migrate deploy
```

> **Importante:** este comando aplica el estado actual del código a la base de datos. Antes de correrlo, confirmar con quien mantiene el proyecto que no hay decisiones de modelo de datos pendientes de definir (por ejemplo, restricciones específicas de la lista de espera que dependen del motor de base de datos).

### 2.4. Cargar datos base (roles y términos y condiciones)

```bash
npm run seed
```

Esto crea los roles del sistema (operador, supervisor, administrador) y una versión inicial (placeholder) de los Términos y Condiciones, si todavía no existen — sin esto, nadie se puede registrar. Es seguro correrlo más de una vez, no duplica nada que ya exista.

Con `NODE_ENV=production` seteado, este paso **no** crea mesas de ejemplo (eso solo pasa en ambientes de desarrollo) — las mesas reales del casino se cargan a mano desde el panel admin, una vez que exista un usuario administrador.

### 2.5. Crear el primer usuario administrador

1. Registrarse normalmente desde la aplicación web, con el email real de quien va a administrar el sistema.
2. Confirmar la cuenta por email (o, si el correo todavía no está configurado, usar el link que el sistema imprime en la consola del servidor como respaldo).
3. Asignarle el rol de administrador. Dos formas, cualquiera de las dos funciona:
   - **Opción rápida**: definir `SEED_ADMIN_EMAIL=<ese email>` en el `.env` y volver a correr `npm run seed` — detecta que la cuenta ya existe y le asigna el rol.
   - **Opción directa** (no requiere tocar el `.env`):
     ```bash
     npx tsx prisma/assign-role.ts <email> ADMIN
     ```
     Este mismo script sirve después para dar de alta al resto del personal (con `OPERADOR` o `SUPERVISOR` en vez de `ADMIN`) — no hay pantalla para esto a propósito, es una operación poco frecuente. Para quitar un rol: agregar `--remove` al final del comando.

### 2.6. Compilar y dejar el backend corriendo

```bash
npm run build
pm2 start dist/index.js --name arena-poker-backend
pm2 save
pm2 startup   # sigue las instrucciones que imprime, para que arranque solo si el servidor reinicia
```

Para ver los logs en cualquier momento: `pm2 logs arena-poker-backend`.

---

## 3. Frontend

### 3.1. Configurar las variables de entorno

Copiar `.env.example` a `.env` en la carpeta del frontend, y completar:

```
VITE_API_URL=https://tu-dominio-del-backend
VITE_TURNSTILE_SITE_KEY=<site key pública de Cloudflare Turnstile>
```

### 3.2. Compilar

```bash
npm install
npm run build
```

Esto genera una carpeta `dist/` con archivos estáticos listos para servir. **Cualquier cambio posterior a estas variables de entorno requiere repetir este paso** — a diferencia del backend, el frontend no lee el `.env` en vivo, lo incrusta en el momento de compilar.

### 3.3. Servir los archivos

Apuntar el servidor web (nginx u otro) a la carpeta `dist/` generada. Como es una aplicación de una sola página (SPA), hay que configurar el servidor para que cualquier ruta que no sea un archivo real devuelva `index.html` (para que el enrutado interno de la aplicación funcione al refrescar la página en una URL interna).

Ejemplo mínimo de configuración en nginx:

```nginx
server {
    listen 443 ssl;
    server_name tu-dominio.com.ar;

    root /ruta/al/frontend/dist;
    index index.html;

    location / {
        try_files $uri /index.html;
    }

    location /socket.io/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # Si el backend NO tiene su propio dominio/subdominio separado,
    # y en cambio se accede a la API desde el mismo dominio bajo /api,
    # habría que agregar acá un proxy_pass hacia el backend. Si el
    # backend vive en su propio subdominio (recomendado, más simple),
    # esto no hace falta.
}
```

---

## 4. Verificación final

Antes de dar por terminado el despliegue, confirmar:

- [ ] `https://tu-dominio-del-backend/health` responde `{"status":"ok"}` — confirma que el backend está corriendo y es alcanzable.
- [ ] Se puede abrir el sitio por `https://` sin advertencias del navegador.
- [ ] Se puede registrar un usuario nuevo y llega el email de verificación.
- [ ] Se puede iniciar sesión.
- [ ] El captcha aparece y funciona en registro, login y recuperar contraseña.
- [ ] Las mesas se actualizan en tiempo real (probar con dos pestañas o dos dispositivos a la vez).
- [ ] El usuario administrador puede entrar al panel admin.
- [ ] En el celular, el navegador ofrece "Instalar app" o similar (confirma que la PWA está funcionando).

---

## 5. Actualizaciones futuras

Cuando haya una nueva versión del código para desplegar:

1. Traer el código nuevo (`git pull` o el mecanismo que corresponda).
2. Backend: `npm install` (por si hay dependencias nuevas), `npx prisma migrate deploy` (por si hay cambios de base de datos), `npm run build`, reiniciar con `pm2 restart arena-poker-backend`.
3. Frontend: `npm install`, `npm run build`, y asegurarse de que el servidor web esté sirviendo la carpeta `dist/` nueva.

No hace falta tocar la base de datos a mano en ninguno de estos pasos — `prisma migrate deploy` se encarga de aplicar solo lo que cambió.

---

*Última actualización: 22/9/2026*
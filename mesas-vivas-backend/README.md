# Mesas Vivas — Backend

## Fase 0: Setup inicial

Requisitos: Node.js 20+, Docker Desktop (o Docker Engine) instalado.

### 1. Instalar dependencias

```bash
npm install
```

### 2. Levantar Postgres local

```bash
docker compose up -d
```

Esto levanta un Postgres en `localhost:5432` con las credenciales que ya están
en `docker-compose.yml` (son solo para desarrollo local, no van a producción).

### 3. Configurar variables de entorno

```bash
cp .env.example .env
```

No hace falta tocar nada por ahora, los valores por defecto coinciden con el
`docker-compose.yml`.

### 4. Generar el cliente de Prisma y validar el schema

```bash
npx prisma validate
npx prisma generate
```

### 5. Levantar el servidor

```bash
npm run dev
```

Abrí `http://localhost:3000/health` — debería devolver `{"status":"ok"}`.

Si todo esto funciona, Fase 0 está lista y podemos avanzar a la migración
inicial de la base de datos (Fase 1).
# ArenaPoker

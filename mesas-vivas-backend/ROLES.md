# Asignar roles a empleados — Mesas Vivas

Este documento explica cómo dar de alta un empleado (OPERADOR, SUPERVISOR o ADMIN) en el sistema. No hay una pantalla en la app para esto — se hace con un script que se corre una sola vez por cada persona nueva, directo contra la base de datos.

## Por qué funciona así

El sistema no tiene una tabla separada de "empleados". Cualquier persona que se registra en la app (formulario normal de jugador) es un `User`. Lo único que distingue a un empleado de un jugador común es que tiene un `Role` asignado (`OPERADOR`, `SUPERVISOR` o `ADMIN`) en la tabla `user_roles`. El script `prisma/assign-role.ts` hace exactamente eso: busca a la persona por email y le asigna (o le quita) un rol.

Se eligió este enfoque en vez de una pantalla de administración porque, al día de hoy, el alta de empleados nuevos es algo infrecuente (rotación baja de personal). Si esto cambia y se vuelve una tarea habitual, tiene sentido construir una pantalla — avisar para priorizarlo.

## Requisitos previos

- Tener acceso a la terminal del servidor donde corre el backend (`mesas-vivas-backend`), con Node.js instalado y las dependencias ya instaladas (`npm install`).
- El archivo `.env` del backend tiene que apuntar a la base de datos de **producción** (`DATABASE_URL`). Verificá esto antes de correr el script — si corrés esto apuntando por error a la base de desarrollo, no vas a ver el cambio reflejado en producción (y viceversa: si corrés contra producción pensando que era desarrollo, vas a estar dando de alta un rol real).
- La base tiene que tener los 3 roles base ya cargados (`OPERADOR`, `SUPERVISOR`, `ADMIN`). Esto ya se hace automáticamente al correr `npm run seed` la primera vez que se despliega el sistema — si el script de asignación te dice que el rol no existe, corré `npm run seed` primero.

## Paso 1 — la persona tiene que registrarse primero

Antes de poder asignarle un rol, la persona tiene que tener una cuenta creada en la app, con el email que va a usar para trabajar. Se registra normalmente desde la pantalla pública de la app (formulario de registro de jugador), y confirma su cuenta por el email que recibe.

Esto es intencional: reutiliza el mismo sistema de registro, verificación de email y contraseña segura que ya existe para jugadores, en vez de tener un flujo de alta de empleados por separado.

## Paso 2 — asignar el rol

Desde la carpeta `mesas-vivas-backend`, corré:

```bash
npx tsx prisma/assign-role.ts <email> <ROL>
```

Ejemplo real:

```bash
npx tsx prisma/assign-role.ts juan.perez@ejemplo.com SUPERVISOR
```

Roles válidos (no importa mayúsculas/minúsculas):

- `OPERADOR`
- `SUPERVISOR`
- `ADMIN`

Si todo salió bien, vas a ver un mensaje como:

```
Listo: Juan Pérez (juan.perez@ejemplo.com) ahora tiene el rol SUPERVISOR.
```

## Quitar un rol (baja de empleado)

Si alguien deja de trabajar en el casino y hay que sacarle el acceso al panel administrativo (sin borrar su cuenta ni su historial como jugador), agregá `--remove` al final:

```bash
npx tsx prisma/assign-role.ts juan.perez@ejemplo.com SUPERVISOR --remove
```

## Después de asignar o quitar un rol

La persona tiene que cerrar sesión y volver a iniciarla (o iniciar sesión por primera vez, si es la primera vez que entra) para que el cambio tenga efecto. El rol se graba en el token de acceso en el momento del login, así que una sesión ya iniciada antes de correr el script no se entera del cambio hasta que se vuelva a loguear.

## Errores comunes

| Mensaje | Qué significa | Qué hacer |
|---|---|---|
| `No se encontró ningún usuario con el email "..."` | La persona todavía no se registró en la app, o se registró con otro email. | Confirmar el email exacto, o pedirle que se registre primero (Paso 1). |
| `El rol "..." no existe en la base.` | La base no tiene los roles base cargados todavía. | Correr `npm run seed` una vez, después reintentar. |
| `Rol inválido: "..."` | Se escribió mal el nombre del rol. | Usar exactamente `OPERADOR`, `SUPERVISOR` o `ADMIN`. |

## Nota de seguridad

Este script tiene acceso directo a la base de datos y no pide ninguna confirmación adicional — quien lo corre puede convertir a cualquier usuario registrado en `ADMIN`. Por eso:

- Solo debería correrlo quien tiene acceso al servidor y al `.env` de producción (hoy: el equipo de sistemas).
- No exponer este script como un endpoint HTTP ni integrarlo a ninguna pantalla sin agregar antes sus propios controles de permisos — tal como está, confía en que el acceso a la terminal del servidor ya es una barrera suficiente.

---
*Última actualización: 18/9/2026*

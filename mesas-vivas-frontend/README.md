# Mesas Vivas — Frontend

Primera versión real: login + mesas vivas conectado al backend (`mesas-vivas-backend`).
Todavía no incluye registro (por ahora, registrate por el backend como veníamos
haciendo con PowerShell), ni panel admin, ni tiempo real (eso es Fase 5 —
por ahora la pantalla se refresca sola cada 4 segundos).

## Instalación

Esta carpeta va **al lado** de `mesas-vivas-backend`, no adentro.

```powershell
npm install
npm run dev
```

Se abre en `http://localhost:5173`. **El backend tiene que estar corriendo
en paralelo** (`npm run dev` en la carpeta de `mesas-vivas-backend`, puerto
3000) — el frontend le habla directo a `http://localhost:3000`.

Iniciá sesión con un usuario que ya hayas registrado y verificado por el
backend.

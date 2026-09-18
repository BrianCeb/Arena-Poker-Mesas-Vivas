import rateLimit from "express-rate-limit";

// Protege register/login/forgot-password/change-password contra intentos
// automatizados: 10 intentos cada 15 minutos por IP. No se aplica a
// refresh/logout porque esos requieren tener ya un token válido, que un
// atacante sin credenciales no tiene.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Demasiados intentos. Probá de nuevo en unos minutos." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Para endpoints públicos de solo lectura (listado de mesas, calendario de
// torneos). El límite es mucho más generoso que el de auth porque acá el
// tráfico legítimo es alto: varios jugadores pueden compartir la misma IP
// (wifi del casino) y la pantalla puede refrescarse seguido. El objetivo
// no es frenar uso normal, sino scraping/abuso evidente.
export const readLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  message: { error: "Demasiadas solicitudes. Esperá un momento." },
  standardHeaders: true,
  legacyHeaders: false,
});
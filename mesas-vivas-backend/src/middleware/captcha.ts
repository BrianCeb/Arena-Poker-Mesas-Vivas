import { Request, Response, NextFunction } from "express";

const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

// Middleware que valida el token de Cloudflare Turnstile contra la API de
// Cloudflare antes de dejar pasar la request. Se agrega en la cadena de
// middlewares de una ruta, igual que authLimiter:
//
//   router.post("/login", authLimiter, verifyCaptcha, async (req, res) => {...})
//
// El frontend manda el token en el body como `captchaToken`.
export async function verifyCaptcha(req: Request, res: Response, next: NextFunction) {
  const secret = process.env.TURNSTILE_SECRET_KEY;

  if (!secret) {
    // No tiramos el servidor abajo por esto, pero sí lo dejamos bien visible:
    // sin secret key configurada, el captcha queda deshabilitado de hecho.
    console.warn(
      "TURNSTILE_SECRET_KEY no está definida — dejando pasar sin verificar captcha. NO debería pasar esto en producción."
    );
    return next();
  }

  const token = req.body?.captchaToken;
  if (!token || typeof token !== "string") {
    return res
      .status(400)
      .json({ error: "Falta la verificación anti-bots. Recargá la página e intentá de nuevo." });
  }

  try {
    const params = new URLSearchParams();
    params.append("secret", secret);
    params.append("response", token);
    if (req.ip) params.append("remoteip", req.ip);

    const verifyRes = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      body: params,
    });
    const data = (await verifyRes.json()) as {
      success: boolean;
      "error-codes"?: string[];
    };

    if (!data.success) {
      console.warn("Turnstile rechazó el token:", data["error-codes"]);
      return res
        .status(400)
        .json({ error: "No pudimos verificar que sos una persona. Recargá la página e intentá de nuevo." });
    }

    next();
  } catch (err) {
    console.error("Error verificando captcha:", err);
    // Fail closed: si Cloudflare no responde, no dejamos pasar el request
    // sin verificar — mejor un error temporal que abrirle la puerta a bots.
    res.status(503).json({ error: "No pudimos verificar el captcha en este momento. Probá de nuevo en unos segundos." });
  }
}
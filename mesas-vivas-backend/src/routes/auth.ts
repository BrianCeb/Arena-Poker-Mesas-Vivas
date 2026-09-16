import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  registerUser,
  verifyEmail,
  loginUser,
  refreshAccessToken,
  logoutUser,
  requestPasswordReset,
  confirmPasswordReset,
  RegisterError,
} from "../services/authService";

const router = Router();

// Protege register/login contra intentos automatizados: 10 intentos cada
// 15 minutos por IP. No aplica a refresh/logout porque esos requieren
// tener ya un token válido, que un atacante sin credenciales no tiene.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Demasiados intentos. Probá de nuevo en unos minutos." },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post("/register", authLimiter, async (req, res) => {
  try {
    const result = await registerUser(req.body);
    res.status(201).json(result);
  } catch (err) {
    if (err instanceof RegisterError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: "Error interno del servidor." });
  }
});

router.get("/verify-email", async (req, res) => {
  // Este GET NO activa la cuenta — solo muestra una página con un botón.
  // Esto es a propósito: muchos clientes de email (Gmail entre ellos)
  // "pre-visitan" automáticamente los links por seguridad antes de que el
  // usuario haga clic, y si el GET tuviera el efecto de activar la cuenta,
  // el escaneo automático consumiría el token sin que el usuario hiciera nada.
  const token = (req.query.token as string) || "";
  res.send(`
    <div style="font-family: sans-serif; text-align: center; margin-top: 80px;">
      <h2>Confirmá tu cuenta</h2>
      <p>Hacé clic en el botón para activar tu cuenta en Mesas Vivas.</p>
      <button id="confirmBtn"
        style="background:#2dd4a7; color:#0b1a15; padding:12px 24px; border:none; border-radius:8px; font-weight:bold; font-size:14px; cursor:pointer;">
        Confirmar mi cuenta
      </button>
      <p id="result" style="margin-top:20px; font-weight:bold;"></p>
      <script>
        document.getElementById('confirmBtn').addEventListener('click', async () => {
          const res = await fetch('/auth/verify-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: ${JSON.stringify(token)} }),
          });
          const data = await res.json();
          document.getElementById('result').textContent = data.message || data.error;
          document.getElementById('confirmBtn').style.display = 'none';
        });
      </script>
    </div>
  `);
});

router.post("/verify-email", async (req, res) => {
  try {
    const token = req.body.token as string;
    const result = await verifyEmail(token);
    res.json(result);
  } catch (err) {
    if (err instanceof RegisterError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: "Error interno del servidor." });
  }
});

router.post("/login", authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await loginUser(email, password, {
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });
    res.json(result);
  } catch (err) {
    if (err instanceof RegisterError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: "Error interno del servidor." });
  }
});

router.post("/refresh", async (req, res) => {
  try {
    const { refreshToken } = req.body;
    const result = await refreshAccessToken(refreshToken);
    res.json(result);
  } catch (err) {
    if (err instanceof RegisterError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: "Error interno del servidor." });
  }
});

router.post("/logout", async (req, res) => {
  try {
    const { refreshToken } = req.body;
    await logoutUser(refreshToken);
    res.json({ message: "Sesión cerrada." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error interno del servidor." });
  }
});

router.post("/forgot-password", authLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    const result = await requestPasswordReset(email);
    res.json(result);
  } catch (err) {
    if (err instanceof RegisterError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: "Error interno del servidor." });
  }
});

router.get("/reset-password", async (req, res) => {
  // Igual que /verify-email: este GET no cambia nada, solo muestra el
  // formulario. El cambio real pasa por el POST, disparado por el usuario.
  const token = (req.query.token as string) || "";
  res.send(`
    <div style="font-family: sans-serif; text-align: center; margin-top: 60px;">
      <h2>Elegí una nueva contraseña</h2>
      <input id="newPassword" type="password" placeholder="Nueva contraseña" style="padding:10px; width:240px; margin-bottom:10px; display:block; margin-left:auto; margin-right:auto;" />
      <input id="confirmPassword" type="password" placeholder="Confirmar contraseña" style="padding:10px; width:240px; margin-bottom:16px; display:block; margin-left:auto; margin-right:auto;" />
      <button id="submitBtn"
        style="background:#2dd4a7; color:#0b1a15; padding:12px 24px; border:none; border-radius:8px; font-weight:bold; font-size:14px; cursor:pointer;">
        Guardar nueva contraseña
      </button>
      <p id="result" style="margin-top:20px; font-weight:bold;"></p>
      <script>
        document.getElementById('submitBtn').addEventListener('click', async () => {
          const newPassword = document.getElementById('newPassword').value;
          const confirmNewPassword = document.getElementById('confirmPassword').value;
          const res = await fetch('/auth/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: ${JSON.stringify(token)}, newPassword, confirmNewPassword }),
          });
          const data = await res.json();
          document.getElementById('result').textContent = data.message || data.error;
        });
      </script>
    </div>
  `);
});

router.post("/reset-password", async (req, res) => {
  try {
    const { token, newPassword, confirmNewPassword } = req.body;
    const result = await confirmPasswordReset(token, newPassword, confirmNewPassword);
    res.json(result);
  } catch (err) {
    if (err instanceof RegisterError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: "Error interno del servidor." });
  }
});

export default router;
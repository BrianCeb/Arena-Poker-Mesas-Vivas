import resend from "../lib/resend";

const FROM = process.env.EMAIL_FROM || "Mesas Vivas <onboarding@resend.dev>";
const BASE_URL = process.env.BACKEND_BASE_URL || "http://localhost:3000";

export async function sendVerificationEmail(
  toEmail: string,
  firstName: string,
  rawToken: string
) {
  const verificationUrl = `${BASE_URL}/auth/verify-email?token=${rawToken}`;

  const { error } = await resend.emails.send({
    from: FROM,
    to: toEmail,
    subject: "Confirmá tu cuenta en Mesas Vivas",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Hola ${firstName},</h2>
        <p>Gracias por registrarte en Mesas Vivas. Para activar tu cuenta, hacé clic en el siguiente botón:</p>
        <p style="text-align: center; margin: 24px 0;">
          <a href="${verificationUrl}"
             style="background:#2dd4a7; color:#0b1a15; padding:12px 24px; border-radius:8px; text-decoration:none; font-weight:bold;">
            Confirmar mi cuenta
          </a>
        </p>
        <p>Este link vence en 24 horas. Si no creaste esta cuenta, podés ignorar este email.</p>
      </div>
    `,
  });

  if (error) {
    // No tiramos la creación del usuario abajo por esto — el usuario ya
    // quedó creado en PENDIENTE, y va a poder pedir un reenvío del email
    // más adelante (Fase 2, endpoint de reenvío — todavía no implementado).
    console.error("Error enviando email de verificación:", error);
    // Solo para desarrollo: si Resend no pudo entregar el email (por ejemplo,
    // por la restricción de modo de prueba que solo permite mandar a la
    // cuenta dueña de la API key), dejamos el link acá para poder probar el
    // flujo de activación igual, copiándolo a mano.
    console.log(`[DEV] Link de verificación (no se pudo enviar por email): ${verificationUrl}`);
    throw new Error("No se pudo enviar el email de verificación.");
  }
}

export async function sendPasswordResetEmail(
  toEmail: string,
  firstName: string,
  rawToken: string
) {
  // El link apunta a una página del backend con un formulario simple,
  // igual que hicimos con la verificación de email — ver el mismo motivo
  // (evitar que un GET con efectos sea "pre-visitado" automáticamente).
  const resetUrl = `${BASE_URL}/auth/reset-password?token=${rawToken}`;

  const { error } = await resend.emails.send({
    from: FROM,
    to: toEmail,
    subject: "Restablecer tu contraseña — Mesas Vivas",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Hola ${firstName},</h2>
        <p>Pediste restablecer tu contraseña. Hacé clic en el siguiente botón para elegir una nueva:</p>
        <p style="text-align: center; margin: 24px 0;">
          <a href="${resetUrl}"
             style="background:#2dd4a7; color:#0b1a15; padding:12px 24px; border-radius:8px; text-decoration:none; font-weight:bold;">
            Restablecer contraseña
          </a>
        </p>
        <p>Este link vence en 1 hora. Si no pediste esto, podés ignorar este email — tu contraseña actual sigue siendo válida.</p>
      </div>
    `,
  });

  if (error) {
    console.error("Error enviando email de reset:", error);
    console.log(`[DEV] Link de recuperación (no se pudo enviar por email): ${resetUrl}`);
    throw new Error("No se pudo enviar el email de recuperación.");
  }
}
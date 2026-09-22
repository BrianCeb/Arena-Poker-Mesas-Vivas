import path from "path";
import transporter from "../lib/mailer";

const FROM = process.env.EMAIL_FROM || "Arena Poker <no-responder@arenamaipu.com.ar>";
const BASE_URL = process.env.BACKEND_BASE_URL || "http://localhost:3000";

// Logo embebido como adjunto (cid), no como URL remota: así se ve en el
// mail sin depender de que el cliente de correo cargue imágenes externas
// (Gmail/Outlook las bloquean por defecto hasta que el usuario acepta).
// El archivo vive en el propio repo del backend, no se sirve por HTTP.
const LOGO_PATH = path.join(__dirname, "../assets/logo-email.png");
const LOGO_CID = "arena-poker-logo";

// ── Paleta — tomada 1:1 de src/App.css (:root) del front ───────────
const COLORS = {
  bg: "#0e0a12",
  surface: "#1a1420",
  border: "#2e2436",
  text: "#f3eef5",
  textDim: "#a89bb0",
  brandRed: "#d43552",
  brandPurple: "#6d28a8",
  radius: "14px",
  radiusSm: "9px",
};

// ── Plantilla base ──────────────────────────────────────────────
// Layout con tablas (no flexbox/grid) a propósito: es lo único que
// se renderiza de forma consistente en Gmail, Outlook y clientes de
// correo móviles. Todo el estilo va inline porque la mayoría de los
// webmails ignora o recorta las etiquetas <style>.
//
// El botón usa `background-color` sólido (brandRed) como fallback y
// `background` con el gradiente como mejora progresiva: Outlook de
// escritorio (motor Word) ignora los gradientes CSS y se queda con
// el color sólido; el resto de los clientes sí lo renderiza.
//
// `preheaderText` es el texto que se ve como "preview" al lado del
// asunto en la bandeja de entrada (Gmail, Outlook, etc.) — se oculta
// visualmente en el cuerpo del mail pero los clientes lo leen igual.

function emailLayout(opts: {
  preheaderText: string;
  heading: string;
  bodyHtml: string;
  ctaLabel: string;
  ctaUrl: string;
  footerNote: string;
}) {
  const { preheaderText, heading, bodyHtml, ctaLabel, ctaUrl, footerNote } = opts;

  return `
<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Arena Poker</title>
  </head>
  <body style="margin:0; padding:0; background-color:${COLORS.bg}; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <!-- Preheader (oculto, solo para el preview de la bandeja de entrada) -->
    <div style="display:none; max-height:0; overflow:hidden; opacity:0;">
      ${preheaderText}
    </div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${COLORS.bg}; padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px; width:100%; background-color:${COLORS.surface}; border:1px solid ${COLORS.border}; border-radius:${COLORS.radius}; overflow:hidden;">

            <!-- Header con el logo -->
            <tr>
              <td style="padding:32px 32px 8px 32px; text-align:center;">
                <img src="cid:${LOGO_CID}" alt="Arena Poker" width="200" style="display:inline-block; width:200px; max-width:70%; height:auto;" />
              </td>
            </tr>

            <!-- Cuerpo -->
            <tr>
              <td style="padding:20px 32px 8px 32px;">
                <h1 style="margin:0 0 16px 0; font-size:20px; line-height:1.3; color:${COLORS.text}; font-weight:700;">
                  ${heading}
                </h1>
                <div style="font-size:15px; line-height:1.6; color:${COLORS.textDim};">
                  ${bodyHtml}
                </div>
              </td>
            </tr>

            <!-- Botón -->
            <tr>
              <td style="padding:16px 32px 8px 32px; text-align:center;">
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                  <tr>
                    <td style="border-radius:${COLORS.radiusSm}; background-color:${COLORS.brandRed}; background:linear-gradient(135deg, ${COLORS.brandRed}, ${COLORS.brandPurple});">
                      <a href="${ctaUrl}"
                         style="display:inline-block; padding:14px 32px; font-size:15px; font-weight:700; color:#ffffff; text-decoration:none; border-radius:${COLORS.radiusSm};">
                        ${ctaLabel}
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Link alternativo por si el botón no funciona -->
            <tr>
              <td style="padding:20px 32px 0 32px;">
                <p style="margin:0; font-size:12px; line-height:1.5; color:${COLORS.textDim};">
                  Si el botón no funciona, copiá y pegá este link en tu navegador:<br />
                  <a href="${ctaUrl}" style="color:${COLORS.brandRed}; word-break:break-all;">${ctaUrl}</a>
                </p>
              </td>
            </tr>

            <!-- Nota inferior -->
            <tr>
              <td style="padding:20px 32px 28px 32px; border-bottom:1px solid ${COLORS.border};">
                <p style="margin:0; font-size:13px; line-height:1.5; color:${COLORS.textDim};">
                  ${footerNote}
                </p>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding:16px 32px; text-align:center;">
                <p style="margin:0; font-size:12px; color:${COLORS.textDim};">
                  Arena Maipú &middot; Este es un email automático, por favor no respondas.
                </p>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`;
}

const LOGO_ATTACHMENT = {
  filename: "arena-poker-logo.png",
  path: LOGO_PATH,
  cid: LOGO_CID,
};

export async function sendVerificationEmail(
  toEmail: string,
  firstName: string,
  rawToken: string
) {
  const verificationUrl = `${BASE_URL}/auth/verify-email?token=${rawToken}`;

  const html = emailLayout({
    preheaderText: `Confirmá tu cuenta para empezar a anotarte en las mesas de Arena Poker.`,
    heading: `Hola ${firstName}, confirmá tu cuenta`,
    bodyHtml: `
      <p style="margin:0 0 12px 0;">Gracias por registrarte en Arena Poker. Para activar tu cuenta y poder anotarte en las listas de espera, confirmá tu email haciendo clic en el botón de abajo.</p>
      <p style="margin:0;">Este link vence en <strong>24 horas</strong>.</p>
    `,
    ctaLabel: "Confirmar mi cuenta",
    ctaUrl: verificationUrl,
    footerNote: "Si no creaste esta cuenta, podés ignorar este email — no se va a activar nada sin confirmar.",
  });

  try {
    await transporter.sendMail({
      from: FROM,
      to: toEmail,
      subject: "Confirmá tu cuenta en Arena Poker",
      html,
      attachments: [LOGO_ATTACHMENT],
    });
  } catch (error) {
    // No tiramos la creación del usuario abajo por esto — el usuario ya
    // quedó creado en PENDIENTE, y va a poder pedir un reenvío del email
    // más adelante (Fase 2, endpoint de reenvío — todavía no implementado).
    console.error("Error enviando email de verificación:", error);
    // Solo para desarrollo: si el SMTP no pudo entregar el email, dejamos
    // el link acá para poder probar el flujo de activación igual,
    // copiándolo a mano.
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

  const html = emailLayout({
    preheaderText: `Pediste restablecer tu contraseña en Arena Poker.`,
    heading: `Hola ${firstName}, restablecé tu contraseña`,
    bodyHtml: `
      <p style="margin:0 0 12px 0;">Pediste restablecer la contraseña de tu cuenta en Arena Poker. Hacé clic en el botón de abajo para elegir una nueva.</p>
      <p style="margin:0;">Este link vence en <strong>1 hora</strong>.</p>
    `,
    ctaLabel: "Restablecer contraseña",
    ctaUrl: resetUrl,
    footerNote: "Si no pediste esto, podés ignorar este email — tu contraseña actual sigue siendo válida y no se va a modificar nada.",
  });

  try {
    await transporter.sendMail({
      from: FROM,
      to: toEmail,
      subject: "Restablecer tu contraseña — Arena Poker",
      html,
      attachments: [LOGO_ATTACHMENT],
    });
  } catch (error) {
    console.error("Error enviando email de reset:", error);
    console.log(`[DEV] Link de recuperación (no se pudo enviar por email): ${resetUrl}`);
    throw new Error("No se pudo enviar el email de recuperación.");
  }
}

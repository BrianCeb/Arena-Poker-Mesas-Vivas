import nodemailer from "nodemailer";

const requiredVars = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS"];
for (const key of requiredVars) {
  if (!process.env[key]) {
    console.warn(`${key} no está definida — el envío de emails va a fallar.`);
  }
}

// SMTP_SECURE=true para conexión SSL directa (puerto 465). Para el caso
// más común (puerto 587, STARTTLS) se deja en false: nodemailer negocia
// TLS solo después de conectar, que es como funciona STARTTLS.
const port = Number(process.env.SMTP_PORT) || 587;
const secure = process.env.SMTP_SECURE === "true";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port,
  secure,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export default transporter;

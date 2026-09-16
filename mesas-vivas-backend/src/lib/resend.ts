import { Resend } from "resend";

if (!process.env.RESEND_API_KEY) {
  console.warn(
    "RESEND_API_KEY no está definida — el envío de emails va a fallar."
  );
}

const resend = new Resend(process.env.RESEND_API_KEY);

export default resend;
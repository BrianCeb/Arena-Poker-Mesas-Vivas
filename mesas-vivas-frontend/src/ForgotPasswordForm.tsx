import { useState } from "react";
import { api } from "./api";
import Turnstile from "./Turnstile";

interface Props {
  onBackToLogin: () => void;
  onClose?: () => void;
}

export default function ForgotPasswordForm({ onBackToLogin, onClose }: Props) {
  const [email, setEmail] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email) {
      setError("Ingresá tu email.");
      return;
    }
    if (!captchaToken) {
      setError("Completá la verificación anti-bots.");
      return;
    }

    setLoading(true);
    try {
      await api.forgotPassword(email, captchaToken);
      // Siempre mostramos el mismo mensaje de éxito, exista o no una
      // cuenta con ese email — así no se puede usar este formulario para
      // averiguar qué emails están registrados (enumeration attack).
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "No pudimos procesar el pedido.");
      setCaptchaToken(null);
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="auth-card">
        <div className="auth-card-icon success">✉️</div>
        <h2>Revisá tu email</h2>
        <p>
          Si <strong>{email}</strong> corresponde a una cuenta registrada, te mandamos un link
          para restablecer tu contraseña. Revisá tu bandeja de entrada (y la carpeta de spam,
          por las dudas). El link vence en 1 hora.
        </p>
        <button className="btn-primary" onClick={onBackToLogin}>Volver al login</button>
      </div>
    );
  }

  return (
    <form className="auth-card" onSubmit={handleSubmit}>
      {onClose && (
        <button type="button" className="auth-close-btn" onClick={onClose}>✕</button>
      )}
      <h2>Recuperar contraseña</h2>
      <p>Ingresá el email con el que te registraste y te mandamos un link para elegir una nueva contraseña.</p>

      {error && <p className="error">{error}</p>}

      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <Turnstile onToken={setCaptchaToken} />

      <button type="submit" disabled={loading}>
        {loading ? "Enviando..." : "Enviar link de recuperación"}
      </button>

      <button type="button" className="link-button" onClick={onBackToLogin}>
        Volver al login
      </button>
    </form>
  );
}
import { useState } from "react";
import { api } from "./api";

interface Props {
  onBackToLogin: () => void;
  onClose?: () => void;
}

const DOCUMENT_TYPES = [
  { value: "DNI", label: "DNI" },
  { value: "LC", label: "Libreta Cívica" },
  { value: "LE", label: "Libreta de Enrolamiento" },
  { value: "PASAPORTE", label: "Pasaporte" },
];

function calculateAge(birthDate: string): number {
  if (!birthDate) return 0;
  const today = new Date();
  const dob = new Date(birthDate);
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

export default function RegisterForm({ onBackToLogin, onClose }: Props) {
  const [documentType, setDocumentType] = useState("DNI");
  const [documentNumber, setDocumentNumber] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [sex, setSex] = useState("");
  const [email, setEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  function validate(): string | null {
    if (
      !documentType ||
      !documentNumber ||
      !firstName ||
      !lastName ||
      !sex ||
      !email ||
      !password ||
      !birthDate
    ) {
      return "Completá todos los campos obligatorios.";
    }
    if (email !== confirmEmail) return "Los emails no coinciden.";
    if (password !== confirmPassword) return "Las contraseñas no coinciden.";
    if (password.length < 8) return "La contraseña debe tener al menos 8 caracteres.";
    if (calculateAge(birthDate) < 18) return "Debés ser mayor de 18 años para registrarte.";
    if (!acceptedTerms) return "Debés aceptar los términos y condiciones.";
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      await api.register({
        documentType,
        documentNumber,
        firstName,
        lastName,
        sex,
        email,
        confirmEmail,
        phone: phone || undefined,
        nickname: nickname || undefined,
        password,
        confirmPassword,
        birthDate,
        acceptedTerms,
      });
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "Error al registrarte.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="auth-card">
        <h2>¡Listo!</h2>
        <p>
          Te mandamos un email a <strong>{email}</strong> con un link para activar tu cuenta.
          Revisá tu bandeja de entrada (y la carpeta de spam, por las dudas).
        </p>
        <button onClick={onBackToLogin}>Volver al login</button>
      </div>
    );
  }

  return (
    <form className="auth-card" onSubmit={handleSubmit}>
      {onClose && (
        <button type="button" className="auth-close-btn" onClick={onClose}>✕</button>
      )}
      <h2>Crear cuenta</h2>

      {error && <p className="error">{error}</p>}

      <div className="form-row">
        <select value={documentType} onChange={(e) => setDocumentType(e.target.value)}>
          {DOCUMENT_TYPES.map((dt) => (
            <option key={dt.value} value={dt.value}>
              {dt.label}
            </option>
          ))}
        </select>
        <input
          placeholder="Número de documento"
          value={documentNumber}
          onChange={(e) => setDocumentNumber(e.target.value)}
        />
      </div>

      <div className="form-row">
        <input
          placeholder="Nombre"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
        />
        <input
          placeholder="Apellido"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
        />
      </div>

      <div className="form-row">
        <select value={sex} onChange={(e) => setSex(e.target.value)}>
          <option value="">Sexo</option>
          <option value="M">Masculino</option>
          <option value="F">Femenino</option>
          <option value="OTRO">Otro</option>
        </select>
        <input
          type="date"
          value={birthDate}
          onChange={(e) => setBirthDate(e.target.value)}
        />
      </div>

      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        type="email"
        placeholder="Confirmar email"
        value={confirmEmail}
        onChange={(e) => setConfirmEmail(e.target.value)}
      />

      <div className="form-row">
        <input
          placeholder="Teléfono (opcional)"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <input
          placeholder="Nick / alias (opcional)"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
        />
      </div>

      <input
        type="password"
        placeholder="Contraseña"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <input
        type="password"
        placeholder="Confirmar contraseña"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
      />

      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={acceptedTerms}
          onChange={(e) => setAcceptedTerms(e.target.checked)}
        />
        Acepto los términos y condiciones
      </label>

      <button type="submit" disabled={loading}>
        {loading ? "Creando cuenta..." : "Crear cuenta"}
      </button>

      <button type="button" className="link-button" onClick={onBackToLogin}>
        Ya tengo cuenta, volver al login
      </button>
    </form>
  );
}
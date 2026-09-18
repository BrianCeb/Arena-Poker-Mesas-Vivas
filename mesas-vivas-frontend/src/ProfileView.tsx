import { useEffect, useState, FormEvent } from "react";
import { api } from "./api";

interface Profile {
  id: string;
  documentType: string;
  documentNumber: string;
  firstName: string;
  lastName: string;
  sex: string;
  email: string;
  phone: string | null;
  nickname: string | null;
  birthDate: string;
  status: string;
  createdAt: string;
}

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  DNI: "DNI",
  LC: "LC",
  LE: "LE",
  PASAPORTE: "Pasaporte",
};

const SEX_LABELS: Record<string, string> = {
  MASCULINO: "Masculino",
  FEMENINO: "Femenino",
  OTRO: "Otro",
};

const STATUS_LABELS: Record<string, string> = {
  PENDIENTE: "Pendiente de activación",
  ACTIVA: "Activa",
  BLOQUEADA: "Bloqueada",
  DESACTIVADA: "Desactivada",
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("es-AR");
}

interface ProfileViewProps {
  onClose: () => void;
  // Se llama tras un cambio de contraseña exitoso. El backend revoca todos
  // los refresh tokens al cambiar la contraseña (misma lógica que el reset
  // por email), así que la sesión actual también queda cortada — el padre
  // debe cerrar sesión localmente y, si quiere, mostrar un aviso.
  onPasswordChanged: () => void;
}

export default function ProfileView({ onClose, onPasswordChanged }: ProfileViewProps) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [phone, setPhone] = useState("");
  const [nickname, setNickname] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState("");
  const [profileMsgIsError, setProfileMsgIsError] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    api
      .getProfile()
      .then((data: Profile) => {
        setProfile(data);
        setPhone(data.phone || "");
        setNickname(data.nickname || "");
      })
      .catch((err) => setLoadError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleSaveProfile(e: FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMsg("");
    try {
      const updated = await api.updateProfile({ phone: phone.trim() || null, nickname: nickname.trim() || null });
      setProfile(updated);
      setProfileMsgIsError(false);
      setProfileMsg("Datos guardados.");
    } catch (err: any) {
      setProfileMsgIsError(true);
      setProfileMsg(err.message);
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault();
    setPasswordError("");

    if (newPassword.length < 8) {
      setPasswordError("La contraseña nueva debe tener al menos 8 caracteres.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordError("Las contraseñas nuevas no coinciden.");
      return;
    }

    setChangingPassword(true);
    try {
      await api.changePassword({ currentPassword, newPassword, confirmNewPassword });
      onPasswordChanged();
    } catch (err: any) {
      setPasswordError(err.message);
    } finally {
      setChangingPassword(false);
    }
  }

  if (loading) {
    return (
      <div className="profile-view">
        <div className="profile-loading">Cargando perfil...</div>
      </div>
    );
  }

  if (loadError || !profile) {
    return (
      <div className="profile-view">
        <div className="admin-form-error">{loadError || "No se pudo cargar el perfil."}</div>
      </div>
    );
  }

  return (
    <div className="profile-view">
      <div className="profile-header">
        <h2>Mi perfil</h2>
        <button className="link-button" onClick={onClose} type="button">
          Volver
        </button>
      </div>

      <div className="profile-section profile-readonly">
        <div className="profile-readonly-row">
          <span className="profile-label">Documento</span>
          <span className="profile-value">
            {DOCUMENT_TYPE_LABELS[profile.documentType] || profile.documentType} {profile.documentNumber}
          </span>
        </div>
        <div className="profile-readonly-row">
          <span className="profile-label">Nombre</span>
          <span className="profile-value">
            {profile.firstName} {profile.lastName}
          </span>
        </div>
        <div className="profile-readonly-row">
          <span className="profile-label">Sexo</span>
          <span className="profile-value">{SEX_LABELS[profile.sex] || profile.sex}</span>
        </div>
        <div className="profile-readonly-row">
          <span className="profile-label">Email</span>
          <span className="profile-value">{profile.email}</span>
        </div>
        <div className="profile-readonly-row">
          <span className="profile-label">Fecha de nacimiento</span>
          <span className="profile-value">{formatDate(profile.birthDate)}</span>
        </div>
        <div className="profile-readonly-row">
          <span className="profile-label">Estado de cuenta</span>
          <span className="profile-value">{STATUS_LABELS[profile.status] || profile.status}</span>
        </div>
      </div>

      <form className="profile-section admin-table-form" onSubmit={handleSaveProfile}>
        <div className="admin-section-title">Datos de contacto</div>
        <label>
          Teléfono
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Opcional" />
        </label>
        <label>
          Nick / alias
          <input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="Opcional" />
        </label>
        {profileMsg && (
          <div className={profileMsgIsError ? "admin-form-error" : "profile-msg-ok"}>{profileMsg}</div>
        )}
        <button type="submit" disabled={savingProfile}>
          {savingProfile ? "Guardando..." : "Guardar cambios"}
        </button>
      </form>

      <form className="profile-section admin-table-form" onSubmit={handleChangePassword}>
        <div className="admin-section-title">Cambiar contraseña</div>
        <label>
          Contraseña actual
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
        </label>
        <label>
          Nueva contraseña
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={8}
          />
        </label>
        <label>
          Confirmar nueva contraseña
          <input
            type="password"
            value={confirmNewPassword}
            onChange={(e) => setConfirmNewPassword(e.target.value)}
            required
            minLength={8}
          />
        </label>
        {passwordError && <div className="admin-form-error">{passwordError}</div>}
        <button type="submit" disabled={changingPassword}>
          {changingPassword ? "Cambiando..." : "Cambiar contraseña"}
        </button>
      </form>
    </div>
  );
}
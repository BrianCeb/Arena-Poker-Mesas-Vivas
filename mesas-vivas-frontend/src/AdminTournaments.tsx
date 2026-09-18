import { useEffect, useState, useCallback } from "react";
import { api } from "./api";

interface Tournament {
  id: string;
  name: string;
  type: string;
  startsAt: string;
  registrationClosesAt: string;
  buyIn: string | number;
  rake: string | number;
  initialStack: number | null;
  blindsIntervalMinutes: number | null;
  reEntryEnabled: boolean;
  reEntryClosesAt: string | null;
  addOnEnabled: boolean;
  addOnPrice: string | number | null;
  addOnRake: string | number | null;
  addOnChips: number | null;
  addOnLevel: number | null;
  guaranteedPot: string | number | null;
  flyerImageUrl: string | null;
  structureImageUrl: string | null;
  notes: string | null;
  status: "PROGRAMADO" | "EN_CURSO" | "FINALIZADO" | "CANCELADO";
}

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const EMPTY_FORM = {
  name: "",
  type: "",
  startsAt: "",
  registrationClosesAt: "",
  buyIn: "",
  rake: "",
  initialStack: "",
  blindsIntervalMinutes: "",
  reEntryEnabled: false,
  reEntryClosesAt: "",
  addOnEnabled: false,
  addOnPrice: "",
  addOnRake: "",
  addOnChips: "",
  addOnLevel: "",
  guaranteedPot: "",
  notes: "",
};

function TournamentForm({
  mode,
  initial,
  onCancel,
  onSaved,
  showToast,
}: {
  mode: "create" | "edit";
  initial: typeof EMPTY_FORM & { id?: string };
  onCancel: () => void;
  onSaved: () => void;
  showToast: (msg: string) => void;
}) {
  const [form, setForm] = useState(initial);
  const [flyerFile, setFlyerFile] = useState<File | null>(null);
  const [structureFile, setStructureFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(key: keyof typeof EMPTY_FORM, value: any) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.name || !form.type || !form.startsAt || !form.registrationClosesAt || !form.buyIn || !form.rake) {
      setError("Nombre, tipo, fecha de inicio, cierre de inscripción, buy-in y rake son obligatorios.");
      return;
    }
    if (form.addOnEnabled && !form.addOnPrice) {
      setError("Si el addon está habilitado, hace falta indicar el precio.");
      return;
    }

    const fd = new FormData();
    Object.entries(form).forEach(([key, value]) => {
      if (value === "" || value === null || value === undefined) return;
      fd.append(key, String(value));
    });
    if (flyerFile) fd.append("flyer", flyerFile);
    if (structureFile) fd.append("structure", structureFile);

    setSaving(true);
    try {
      if (mode === "create") {
        await api.createTournamentAdmin(fd);
        showToast(`Torneo "${form.name}" creado.`);
      } else {
        await api.updateTournamentAdmin(initial.id!, fd);
        showToast(`Torneo "${form.name}" actualizado.`);
      }
      onSaved();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="admin-table-form" onSubmit={handleSubmit}>
      <div className="admin-section-title">{mode === "create" ? "Nuevo torneo" : `Editar ${initial.name}`}</div>
      {error && <div className="admin-form-error">{error}</div>}

      <div className="form-row">
        <label>
          Nombre
          <input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Domingo Freezeout" />
        </label>
        <label>
          Tipo
          <input value={form.type} onChange={(e) => set("type", e.target.value)} placeholder="Freezeout, Bounty, Sit & Go..." />
        </label>
      </div>

      <div className="form-row">
        <label>
          Comienza
          <input type="datetime-local" value={form.startsAt} onChange={(e) => set("startsAt", e.target.value)} />
        </label>
        <label>
          Cierre de inscripción
          <input type="datetime-local" value={form.registrationClosesAt} onChange={(e) => set("registrationClosesAt", e.target.value)} />
        </label>
      </div>

      <div className="form-row">
        <label>
          Buy-in
          <input type="number" value={form.buyIn} onChange={(e) => set("buyIn", e.target.value)} />
        </label>
        <label>
          Rake
          <input type="number" value={form.rake} onChange={(e) => set("rake", e.target.value)} />
        </label>
      </div>

      <div className="form-row">
        <label>
          Stack inicial (opcional)
          <input type="number" value={form.initialStack} onChange={(e) => set("initialStack", e.target.value)} />
        </label>
        <label>
          Ciegas cada (min, opcional)
          <input type="number" value={form.blindsIntervalMinutes} onChange={(e) => set("blindsIntervalMinutes", e.target.value)} />
        </label>
      </div>

      <label className="checkbox-row">
        <input type="checkbox" checked={form.reEntryEnabled} onChange={(e) => set("reEntryEnabled", e.target.checked)} />
        Re-entry habilitado
      </label>
      {form.reEntryEnabled && (
        <label>
          Cierre de re-entries
          <input type="datetime-local" value={form.reEntryClosesAt} onChange={(e) => set("reEntryClosesAt", e.target.value)} />
        </label>
      )}

      <label className="checkbox-row">
        <input type="checkbox" checked={form.addOnEnabled} onChange={(e) => set("addOnEnabled", e.target.checked)} />
        Addon disponible
      </label>
      {form.addOnEnabled && (
        <>
          <div className="form-row">
            <label>
              Precio del addon
              <input type="number" value={form.addOnPrice} onChange={(e) => set("addOnPrice", e.target.value)} />
            </label>
            <label>
              Rake del addon
              <input type="number" value={form.addOnRake} onChange={(e) => set("addOnRake", e.target.value)} />
            </label>
          </div>
          <div className="form-row">
            <label>
              Fichas del addon
              <input type="number" value={form.addOnChips} onChange={(e) => set("addOnChips", e.target.value)} />
            </label>
            <label>
              Nivel en que se hace
              <input type="number" value={form.addOnLevel} onChange={(e) => set("addOnLevel", e.target.value)} />
            </label>
          </div>
        </>
      )}

      <label>
        Pozo asegurado (opcional, no se muestra en la card)
        <input type="number" value={form.guaranteedPot} onChange={(e) => set("guaranteedPot", e.target.value)} />
      </label>

      <label className="admin-form-full">
        Observaciones
        <input value={form.notes} onChange={(e) => set("notes", e.target.value)} />
      </label>

      <div className="form-row">
        <label>
          Flyer (imagen)
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setFlyerFile(e.target.files?.[0] || null)} />
        </label>
        <label>
          Estructura de ciegas (imagen)
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setStructureFile(e.target.files?.[0] || null)} />
        </label>
      </div>

      <div className="admin-form-actions">
        <button type="submit" className="admin-action-btn accent" disabled={saving}>
          {saving ? "Guardando..." : mode === "create" ? "Crear torneo" : "Guardar cambios"}
        </button>
        <button type="button" className="admin-action-btn" onClick={onCancel} disabled={saving}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

export default function AdminTournaments() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [formMode, setFormMode] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<Tournament | null>(null);
  const [toast, setToast] = useState("");

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }

  const loadTournaments = useCallback(async () => {
    try {
      const data = await api.getTournamentsAdmin();
      setTournaments(data);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    loadTournaments();
  }, [loadTournaments]);

  async function handleStatusChange(t: Tournament, status: string) {
    try {
      await api.updateTournamentStatus(t.id, status);
      showToast(`"${t.name}" actualizado.`);
      loadTournaments();
    } catch (err: any) {
      showToast(err.message);
    }
  }

  async function handleDuplicate(t: Tournament) {
    try {
      await api.duplicateTournament(t.id);
      showToast(`"${t.name}" duplicado (una semana después).`);
      loadTournaments();
    } catch (err: any) {
      showToast(err.message);
    }
  }

  async function handleDelete(t: Tournament) {
    if (!window.confirm(`¿Eliminar "${t.name}" del calendario?`)) return;
    try {
      await api.deleteTournament(t.id);
      showToast(`"${t.name}" eliminado.`);
      if (editing?.id === t.id) setFormMode(null);
      loadTournaments();
    } catch (err: any) {
      showToast(err.message);
    }
  }

  return (
    <div className="admin-panel">
      <div className="admin-tables-list">
        <button className="admin-action-btn accent admin-new-table-btn" onClick={() => setFormMode("create")}>
          + Nuevo torneo
        </button>

        {tournaments.map((t) => (
          <div key={t.id} className="admin-table-row">
            <div>
              <div className="admin-table-name">{t.name}</div>
              <div className="admin-table-sub">
                {t.type} · {new Date(t.startsAt).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })} · {t.status}
              </div>
            </div>
            <div className="admin-row-actions">
              <button className="admin-toggle-btn" onClick={() => { setEditing(t); setFormMode("edit"); }}>Editar</button>
              <button className="admin-toggle-btn" onClick={() => handleDuplicate(t)}>Duplicar</button>
              {t.status !== "CANCELADO" && (
                <button className="admin-toggle-btn danger" onClick={() => handleStatusChange(t, "CANCELADO")}>Cancelar</button>
              )}
              {t.status !== "FINALIZADO" && (
                <button className="admin-toggle-btn" onClick={() => handleStatusChange(t, "FINALIZADO")}>Finalizar</button>
              )}
              {(t.status === "CANCELADO" || t.status === "FINALIZADO") && (
                <button className="admin-toggle-btn accent" onClick={() => handleStatusChange(t, "PROGRAMADO")}>Reabrir</button>
              )}
              <button className="admin-toggle-btn danger" onClick={() => handleDelete(t)}>Baja</button>
            </div>
          </div>
        ))}
      </div>

      {formMode === "create" && (
        <div className="admin-detail">
          <TournamentForm
            mode="create"
            initial={EMPTY_FORM}
            onCancel={() => setFormMode(null)}
            onSaved={() => { setFormMode(null); loadTournaments(); }}
            showToast={showToast}
          />
        </div>
      )}

      {formMode === "edit" && editing && (
        <div className="admin-detail">
          <TournamentForm
            mode="edit"
            initial={{
              id: editing.id,
              name: editing.name,
              type: editing.type,
              startsAt: toDatetimeLocal(editing.startsAt),
              registrationClosesAt: toDatetimeLocal(editing.registrationClosesAt),
              buyIn: String(editing.buyIn),
              rake: String(editing.rake),
              initialStack: editing.initialStack != null ? String(editing.initialStack) : "",
              blindsIntervalMinutes: editing.blindsIntervalMinutes != null ? String(editing.blindsIntervalMinutes) : "",
              reEntryEnabled: editing.reEntryEnabled,
              reEntryClosesAt: toDatetimeLocal(editing.reEntryClosesAt),
              addOnEnabled: editing.addOnEnabled,
              addOnPrice: editing.addOnPrice != null ? String(editing.addOnPrice) : "",
              addOnRake: editing.addOnRake != null ? String(editing.addOnRake) : "",
              addOnChips: editing.addOnChips != null ? String(editing.addOnChips) : "",
              addOnLevel: editing.addOnLevel != null ? String(editing.addOnLevel) : "",
              guaranteedPot: editing.guaranteedPot != null ? String(editing.guaranteedPot) : "",
              notes: editing.notes || "",
            }}
            onCancel={() => setFormMode(null)}
            onSaved={() => { setFormMode(null); loadTournaments(); }}
            showToast={showToast}
          />
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
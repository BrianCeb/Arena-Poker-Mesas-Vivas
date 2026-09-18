import { useState } from "react";
import { api, TableInput } from "./api";

export default function TableForm({
  mode,
  initial,
  onCancel,
  onSaved,
  showToast,
}: {
  mode: "create" | "edit";
  initial: TableInput & { id?: string };
  onCancel: () => void;
  onSaved: () => void;
  showToast: (msg: string) => void;
}) {
  const [form, setForm] = useState<TableInput>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof TableInput>(key: K, value: TableInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (mode === "create" && (!form.name || !form.gameType || form.smallBlind == null || form.bigBlind == null)) {
      setError("Nombre, tipo de juego y ciegas son obligatorios.");
      return;
    }
    if (form.stradleMode !== "NO" && !form.stradleAmount) {
      setError("Si el stradle es opcional u obligatorio, hace falta indicar el monto.");
      return;
    }

    setSaving(true);
    try {
      if (mode === "create") {
        await api.createTable(form);
        showToast(`Mesa "${form.name}" creada.`);
      } else {
        const { name, ...editableFields } = form;
        await api.updateTable(initial.id!, editableFields);
        showToast(`Mesa "${initial.name}" actualizada.`);
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
      <div className="admin-section-title">{mode === "create" ? "Nueva mesa" : `Editar ${initial.name}`}</div>
      {error && <div className="admin-form-error">{error}</div>}

      <div className="form-row">
        <label>
          Nombre
          <input
            value={form.name || ""}
            onChange={(e) => set("name", e.target.value)}
            disabled={mode === "edit"}
            placeholder="Mesa 5"
          />
        </label>
        <label>
          Tipo de juego
          <input
            value={form.gameType || ""}
            onChange={(e) => set("gameType", e.target.value)}
            placeholder="Texas Hold'em"
          />
        </label>
      </div>

      <div className="form-row">
        <label>
          Ciega chica
          <input
            type="number"
            value={form.smallBlind ?? ""}
            onChange={(e) => set("smallBlind", e.target.value === "" ? undefined : Number(e.target.value))}
          />
        </label>
        <label>
          Ciega grande
          <input
            type="number"
            value={form.bigBlind ?? ""}
            onChange={(e) => set("bigBlind", e.target.value === "" ? undefined : Number(e.target.value))}
          />
        </label>
      </div>

      <div className="form-row">
        <label>
          Buy-in mínimo (opcional)
          <input
            type="number"
            value={form.minBuyIn ?? ""}
            onChange={(e) => set("minBuyIn", e.target.value === "" ? undefined : Number(e.target.value))}
          />
        </label>
        <label>
          Buy-in máximo (opcional)
          <input
            type="number"
            value={form.maxBuyIn ?? ""}
            onChange={(e) => set("maxBuyIn", e.target.value === "" ? undefined : Number(e.target.value))}
          />
        </label>
      </div>

      <div className="form-row">
        <label>
          Capacidad
          <input
            type="number"
            value={form.capacity ?? ""}
            onChange={(e) => set("capacity", e.target.value === "" ? undefined : Number(e.target.value))}
          />
        </label>
        <label>
          Mínimo para arrancar
          <input
            type="number"
            value={form.minPlayersToStart ?? ""}
            onChange={(e) => set("minPlayersToStart", e.target.value === "" ? undefined : Number(e.target.value))}
          />
        </label>
      </div>

      <div className="form-row">
        <label>
          Stradle
          <select value={form.stradleMode} onChange={(e) => set("stradleMode", e.target.value)}>
            <option value="NO">No</option>
            <option value="OPCIONAL">Opcional</option>
            <option value="OBLIGATORIO">Obligatorio</option>
          </select>
        </label>
        {form.stradleMode !== "NO" && (
          <label>
            Monto del stradle
            <input
              type="number"
              value={form.stradleAmount ?? ""}
              onChange={(e) => set("stradleAmount", e.target.value === "" ? undefined : Number(e.target.value))}
            />
          </label>
        )}
      </div>

      {mode === "edit" && (
        <label className="admin-form-full">
          Observaciones
          <input
            value={form.notes || ""}
            onChange={(e) => set("notes", e.target.value)}
          />
        </label>
      )}

      <div className="admin-form-actions">
        <button type="submit" className="admin-action-btn accent" disabled={saving}>
          {saving ? "Guardando..." : mode === "create" ? "Crear mesa" : "Guardar cambios"}
        </button>
        <button type="button" className="admin-action-btn" onClick={onCancel} disabled={saving}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
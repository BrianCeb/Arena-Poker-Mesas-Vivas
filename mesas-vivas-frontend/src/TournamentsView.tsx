import { useEffect, useState } from "react";
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
  addOnChips: number | null;
  addOnLevel: number | null;
  flyerImageUrl: string | null;
  structureImageUrl: string | null;
  notes: string | null;
  status: "PROGRAMADO" | "EN_CURSO" | "FINALIZADO" | "CANCELADO";
}

function formatMoney(v: string | number | null | undefined) {
  if (v == null) return "-";
  return `$${Number(v).toLocaleString("es-AR")}`;
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCountdown(ms: number) {
  if (ms <= 0) return "0m";
  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function tournamentStatusInfo(t: Tournament, now: number) {
  if (t.status === "CANCELADO") return { label: "Cancelado", cls: "badge-closed" };
  if (t.status === "FINALIZADO") return { label: "Finalizado", cls: "badge-closed" };

  const startsAt = new Date(t.startsAt).getTime();
  const regCloses = new Date(t.registrationClosesAt).getTime();

  if (now < startsAt) {
    const diff = startsAt - now;
    if (diff > 24 * 60 * 60 * 1000) {
      const days = Math.ceil(diff / (24 * 60 * 60 * 1000));
      return { label: `Faltan ${days} día${days === 1 ? "" : "s"}`, cls: "badge-starting" };
    }
    return { label: `Comienza en ${formatCountdown(diff)}`, cls: "badge-starting" };
  }

  if (now < regCloses) {
    return { label: `Cierre de inscripción en ${formatCountdown(regCloses - now)}`, cls: "badge-open" };
  }

  return { label: "Inscripción cerrada", cls: "badge-closed" };
}

export default function TournamentsView() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selected, setSelected] = useState<Tournament | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    api.getTournaments().then(setTournaments).catch(() => setTournaments([]));
  }, []);

  useEffect(() => {
    // Refresca las cuentas regresivas cada 30s — no hace falta más precisión.
    const interval = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <main>
      <div className="section-title">Torneos</div>
      {tournaments.length === 0 && (
        <div className="empty-state">No hay torneos programados por ahora.</div>
      )}
      {tournaments.map((t) => {
        const status = tournamentStatusInfo(t, now);
        return (
          <div className="table-card" key={t.id} onClick={() => setSelected(t)}>
            <div className="table-card-top">
              <div>
                <div className="table-name">{t.name}</div>
                <div className="table-game">{t.type}</div>
              </div>
              <div className={`badge ${status.cls}`}>{status.label}</div>
            </div>
            <div className="tournament-datetime">{formatDateTime(t.startsAt)}</div>
            <div className="blinds-row">
              <div className="stat">
                <div className="stat-label">Buy-in</div>
                <div className="stat-value">{formatMoney(t.buyIn)}</div>
              </div>
              <div className="stat">
                <div className="stat-label">Rake</div>
                <div className="stat-value">{formatMoney(t.rake)}</div>
              </div>
              {t.initialStack != null && (
                <div className="stat">
                  <div className="stat-label">Stack</div>
                  <div className="stat-value">{t.initialStack.toLocaleString("es-AR")}</div>
                </div>
              )}
            </div>
            <div className="tournament-extra-row">
              {t.blindsIntervalMinutes != null && <span>Ciegas c/{t.blindsIntervalMinutes}min</span>}
              {t.reEntryEnabled && <span>Re-entry</span>}
              {t.addOnEnabled && <span>Addon</span>}
            </div>
          </div>
        );
      })}

      {selected && (
        <div className="tournament-modal-backdrop" onClick={() => setSelected(null)}>
          <div className="tournament-modal" onClick={(e) => e.stopPropagation()}>
            <button className="tournament-modal-close" onClick={() => setSelected(null)}>✕</button>
            <h2>{selected.name}</h2>
            <div className="tournament-modal-sub">
              {selected.type} · {formatDateTime(selected.startsAt)}
            </div>

            <div className="tournament-modal-details">
              <div><strong>Buy-in:</strong> {formatMoney(selected.buyIn)}</div>
              <div><strong>Rake:</strong> {formatMoney(selected.rake)}</div>
              {selected.initialStack != null && (
                <div><strong>Stack inicial:</strong> {selected.initialStack.toLocaleString("es-AR")}</div>
              )}
              {selected.blindsIntervalMinutes != null && (
                <div><strong>Ciegas cada:</strong> {selected.blindsIntervalMinutes} min</div>
              )}
              <div><strong>Cierre de inscripción:</strong> {formatDateTime(selected.registrationClosesAt)}</div>
              <div><strong>Re-entry:</strong> {selected.reEntryEnabled ? "Habilitado" : "No habilitado"}</div>
              {selected.reEntryEnabled && selected.reEntryClosesAt && (
                <div><strong>Cierre de re-entries:</strong> {formatDateTime(selected.reEntryClosesAt)}</div>
              )}
              {selected.addOnEnabled && (
                <div>
                  <strong>Addon:</strong> {formatMoney(selected.addOnPrice)}
                  {selected.addOnChips != null && ` · ${selected.addOnChips.toLocaleString("es-AR")} fichas`}
                  {selected.addOnLevel != null && ` · nivel ${selected.addOnLevel}`}
                </div>
              )}
              {selected.notes && <div><strong>Observaciones:</strong> {selected.notes}</div>}
            </div>

            {selected.flyerImageUrl && (
              <div className="tournament-modal-image-section">
                <div className="tournament-modal-image-title">Flyer</div>
                <img src={selected.flyerImageUrl} alt={`Flyer ${selected.name}`} />
              </div>
            )}
            {selected.structureImageUrl && (
              <div className="tournament-modal-image-section">
                <div className="tournament-modal-image-title">Estructura de ciegas</div>
                <img src={selected.structureImageUrl} alt={`Estructura ${selected.name}`} />
              </div>
            )}
            {!selected.flyerImageUrl && !selected.structureImageUrl && (
              <div className="empty-state">Todavía no se cargaron imágenes para este torneo.</div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
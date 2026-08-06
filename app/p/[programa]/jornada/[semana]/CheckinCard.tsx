"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Presence, not consumption.
 *
 * Scanning the table's QR during the week's game days doubles the score. It
 * costs nothing to do and the card says so out loud — that line is not a
 * courtesy, it is the sentence that keeps the programme a contest instead of a
 * lottery. If spending money could raise a leaderboard position, buying more
 * would improve the odds of winning, and the whole thing changes category.
 *
 * The branch is picked here rather than derived from anything, because the QR
 * belongs to a table and a table cannot tell us who is sitting at it. One
 * check-in per player per week; the database holds that limit.
 */

const ERRORS: Record<string, string> = {
  outside_window: "El check-in solo cuenta los días de partido de esta jornada.",
  already_checked_in: "Ya hiciste check-in esta jornada.",
  unknown_venue: "Esa sucursal no está en el programa.",
  not_verified: "Necesitas confirmar tu número primero.",
  not_live: "El programa todavía no abre.",
  db_error: "Algo falló de nuestro lado. Inténtalo otra vez.",
};

export function CheckinCard({
  slug,
  week,
  venues,
  checkedInAt,
  multiplier,
  live,
}: {
  slug: string;
  week: number;
  venues: string[];
  /** The branch already checked into this week, or null. */
  checkedInAt: string | null;
  /** What the check-in adds to the week's multiplier. */
  multiplier: number;
  live: boolean;
}) {
  const router = useRouter();
  const [venue, setVenue] = useState(venues[0] ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (checkedInAt) {
    return (
      <div className="pk-mech is-on">
        <div className="pk-mech-text">
          <div className="pk-mech-name">Check-in listo</div>
          <div className="pk-mech-sub">Estás en {checkedInAt}</div>
        </div>
        <div className="pk-mech-val">×{1 + multiplier}</div>
      </div>
    );
  }

  const submit = async () => {
    if (busy || !venue || !live) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/pickem/${slug}/checkin/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ week, venue }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(ERRORS[json?.error] ?? "No pudimos registrar tu check-in.");
        setBusy(false);
        return;
      }
      router.refresh();
    } catch {
      setError("No hay conexión. Inténtalo otra vez.");
      setBusy(false);
    }
  };

  return (
    <div className="sg-card">
      <div className="sg-eyebrow" style={{ marginBottom: 6 }}>
        Multiplica tu jornada ×{1 + multiplier}
      </div>
      <div className="sg-field" style={{ marginBottom: 10 }}>
        <label htmlFor="venue">¿En qué sucursal estás?</label>
        <select id="venue" value={venue} onChange={(e) => setVenue(e.target.value)}>
          {venues.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </div>
      {error ? <div className="sg-error" style={{ marginBottom: 8 }}>{error}</div> : null}
      <button className="sg-btn sm" onClick={submit} disabled={busy || !live}>
        {busy ? "Registrando…" : "Estoy en Chapa"}
      </button>
      <p className="sg-foot" style={{ marginTop: 8, marginBottom: 0 }}>
        Entrar y escanear no cuesta nada. El multiplicador premia que estés en Chapa, no
        que consumas.
      </p>
    </div>
  );
}

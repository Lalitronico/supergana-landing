"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { memo, useCallback, useMemo, useState } from "react";
import type { Game, Mechanics } from "@/lib/pickem/schema";
import { formatKickoff, qualifiesEarly } from "@/lib/pickem/schedule";
import { teamOf } from "@/lib/pickem/teams";
import { TeamMark } from "../../TeamMark";

/**
 * Making picks. The most-used interaction in the product.
 *
 * WHY THE ROW IS ITS OWN MEMOISED COMPONENT.
 *
 * Tapping a side must not disturb the list. The handoff is blunt about it: a
 * full re-render sends the sixteen matches back to the top of the scroll on
 * every tap, which makes the screen unusable on a phone — and the phone view
 * IS the product. React will not reset the scroll position by itself, but it
 * will re-render sixteen rows for a change that affects one, and on a mid-range
 * Android under a restaurant's wifi that is felt. `memo` plus a stable
 * `onPick` means the fifteen rows nobody touched do no work at all.
 */

type Side = "away" | "home";
type Picks = Record<string, Side>;

const ERRORS: Record<string, string> = {
  not_verified: "Necesitas confirmar tu número antes de jugar.",
  week_not_open: "Esta jornada ya no acepta picks.",
  week_locked: "La jornada cerró al primer kickoff.",
  incomplete_picks: "Faltan partidos por elegir.",
  unknown_game: "Algo cambió en el calendario. Recarga la página.",
  not_live: "El programa todavía no abre. Avísale al personal de Chapa.",
  not_a_participant: "No encontramos tu registro en este dispositivo.",
  db_error: "Algo falló de nuestro lado. Inténtalo otra vez.",
};

const MatchRow = memo(function MatchRow({
  game,
  tz,
  pick,
  onPick,
}: {
  game: Game;
  tz: string;
  pick: Side | undefined;
  onPick: (gameId: string, side: Side) => void;
}) {
  const away = teamOf(game.away);
  const home = teamOf(game.home);

  const side = (which: Side, team: typeof away, abbr: string) => (
    <button
      type="button"
      className={`pk-side${which === "home" ? " right" : ""}${pick === which ? " is-picked" : ""}`}
      onClick={() => onPick(game.id, which)}
      aria-pressed={pick === which}
      aria-label={`Elegir ${team.name}`}
    >
      <TeamMark abbr={abbr} />
      <span style={{ minWidth: 0 }}>
        <span className="pk-side-name">{team.name}</span>
        <span className="pk-side-city" style={{ display: "block" }}>{team.city}</span>
      </span>
    </button>
  );

  return (
    <div className="pk-match">
      <div className="pk-match-head">
        <span>{formatKickoff(game.kickoffAt, tz)}</span>
        <span>{game.venueNote || game.network || "Cadena por definir"}</span>
      </div>
      <div className="pk-match-body">
        {side("away", away, game.away)}
        <div className="pk-at">@</div>
        {side("home", home, game.home)}
      </div>
    </div>
  );
});

export function PicksBoard({
  slug,
  week,
  games,
  tz,
  lockAt,
  mechanics,
  initialPicks,
  initialTiebreak,
  closingLabel,
  live,
  strip,
  checkin,
}: {
  slug: string;
  week: number;
  games: Game[];
  tz: string;
  lockAt: string | null;
  mechanics: Mechanics;
  initialPicks: Picks;
  initialTiebreak: number | null;
  /** "DEN–KC", the match whose total the tiebreak predicts. */
  closingLabel: string | null;
  /** False while the programme is in draft: the board renders and refuses. */
  live: boolean;
  /** The season strip, rendered by the server so it stays out of this bundle. */
  strip?: React.ReactNode;
  /** The check-in card, when the branch window is open. Also server-rendered. */
  checkin?: React.ReactNode;
}) {
  const router = useRouter();
  const [picks, setPicks] = useState<Picks>(initialPicks);
  const [tiebreak, setTiebreak] = useState<string>(
    initialTiebreak === null ? "" : String(initialTiebreak),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const playable = useMemo(() => games.filter((g) => !g.voided), [games]);

  // Stable across renders, so `memo` on the row actually holds.
  const onPick = useCallback((gameId: string, side: Side) => {
    setSaved(false);
    setPicks((prev) => (prev[gameId] === side ? prev : { ...prev, [gameId]: side }));
  }, []);

  const chosen = playable.filter((g) => picks[g.id]).length;
  const missing = playable.length - chosen;
  const complete = missing === 0;
  const early = qualifiesEarly(lockAt, mechanics.earlyHours, new Date());

  const submit = async () => {
    if (!complete || saving) return;
    setSaving(true);
    setError(null);
    try {
      const body = {
        week,
        picks: Object.fromEntries(playable.map((g) => [g.id, picks[g.id]])),
        tiebreak: tiebreak.trim() === "" ? null : Number(tiebreak),
      };
      const res = await fetch(`/api/pickem/${slug}/picks/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(ERRORS[json?.error] ?? "No pudimos guardar tus picks.");
        setSaving(false);
        return;
      }
      setSaved(true);
      setSaving(false);
      // Re-reads the week from the server so the saved state is the server's
      // answer, not this component's optimism.
      router.refresh();
    } catch {
      setError("No hay conexión. Inténtalo otra vez.");
      setSaving(false);
    }
  };

  return (
    <>
      <div className="sg-screen">
        <div className="sg-pad">
          <div>
            <div className="sg-eyebrow">
              Jornada {week} · {playable.length} partidos
            </div>
            <h1 className="sg-display" style={{ marginTop: 6 }}>
              Haz tus
              <br />
              picks
            </h1>
            <p className="sg-body" style={{ marginTop: 8, marginBottom: 0 }}>
              Elige al ganador de cada partido.
              {lockAt ? ` Cierran el ${formatKickoff(lockAt, tz)}.` : ""}
            </p>
          </div>

          {strip}
          {checkin}

          {/* Progress as a sentence and a bar. The number is what people check
              before deciding whether they have time to finish now. */}
          <div>
            <div
              style={{
                height: 10,
                border: "2.5px solid var(--sg-ink)",
                borderRadius: 999,
                background: "#fff",
                overflow: "hidden",
              }}
              role="progressbar"
              aria-valuenow={chosen}
              aria-valuemin={0}
              aria-valuemax={playable.length}
            >
              <div
                style={{
                  width: `${playable.length ? (chosen / playable.length) * 100 : 0}%`,
                  height: "100%",
                  background: "var(--sg-yellow)",
                  transition: "width 140ms ease",
                }}
              />
            </div>
            <div
              className="sg-eyebrow"
              style={{ marginTop: 6, display: "flex", justifyContent: "space-between" }}
            >
              <span>
                {chosen} de {playable.length} elegidos
              </span>
              <span>{mechanics.hit} pts por acierto</span>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {playable.map((g) => (
              <MatchRow key={g.id} game={g} tz={tz} pick={picks[g.id]} onPick={onPick} />
            ))}
          </div>

          {/* The tiebreak sits after the matches because it is the last decision
              and the least urgent — and because putting a number field above
              sixteen taps is how somebody stalls before starting. */}
          <div className="sg-card">
            <div className="sg-field">
              <label htmlFor="tiebreak">
                Desempate{closingLabel ? ` · puntos totales del cierre (${closingLabel})` : ""}
              </label>
              <input
                id="tiebreak"
                value={tiebreak}
                onChange={(e) => {
                  setSaved(false);
                  setTiebreak(e.target.value.replace(/\D/g, "").slice(0, 3));
                }}
                inputMode="numeric"
                placeholder="45"
              />
              <span className="sg-foot">
                Si le atinas con margen de ±{mechanics.tiebreakMargin} puntos, sumas{" "}
                {mechanics.tiebreak} extra y ganas cualquier empate.
              </span>
            </div>
          </div>

          {early ? (
            <div className="pk-mech is-on">
              <div className="pk-mech-text">
                <div className="pk-mech-name">Madrugador</div>
                <div className="pk-mech-sub">
                  Envías con más de {mechanics.earlyHours} h de anticipación
                </div>
              </div>
              <div className="pk-mech-val">+{mechanics.early}</div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="sg-dock">
        {error ? <div className="sg-error">{error}</div> : null}
        <button className="sg-btn" onClick={submit} disabled={!complete || saving || !live}>
          {!live
            ? "Vista previa"
            : saving
              ? "Guardando…"
              : !complete
                ? `Faltan ${missing} pick${missing === 1 ? "" : "s"}`
                : saved
                  ? "Picks guardados ✓"
                  : "Enviar mis picks"}
        </button>
        <p className="sg-foot" style={{ margin: 0, textAlign: "center" }}>
          Los puedes cambiar hasta el primer kickoff.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <Link className="sg-btn ghost sm" href={`/p/${slug}/ranking/`}>
            Ranking
          </Link>
          <Link className="sg-btn ghost sm" href={`/p/${slug}/premios/`}>
            Premios
          </Link>
        </div>
      </div>
    </>
  );
}

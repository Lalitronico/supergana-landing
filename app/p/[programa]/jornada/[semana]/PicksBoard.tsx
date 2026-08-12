"use client";

import { useRouter } from "next/navigation";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Game, Mechanics } from "@/lib/pickem/schema";
import { formatKickoff, qualifiesEarly } from "@/lib/pickem/schedule";
import { teamOf } from "@/lib/pickem/teams";
import { ChapaCharacter } from "../../ChapaCharacter";
import { TeamMark } from "../../TeamMark";
import { SavedCelebration } from "./SavedCelebration";

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

/**
 * What the sheet says right now, as one comparable string.
 *
 * Entries are sorted before serialising because `{...prev, [id]: side}` keeps
 * insertion order and the server's copy arrives in its own: without the sort,
 * a sheet identical to the saved one would serialise differently and the board
 * would claim unsaved changes that do not exist.
 */
const snapshotOf = (picks: Picks, tiebreak: string): string =>
  JSON.stringify({
    picks: Object.entries(picks).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
    tiebreak: tiebreak.trim(),
  });

/**
 * Where a half-finished sheet lives between visits.
 *
 * Sixteen taps is a lot to lose to a phone call, a dead battery or a tab the
 * browser evicted for memory — and until the sheet is complete there is nothing
 * to POST, so the server cannot hold it. Per programme AND per week, because
 * two weeks of a season are two different sheets and a player may have the next
 * one open in another tab.
 */
const draftKey = (slug: string, week: number) => `pk-draft:${slug}:${week}`;

interface Draft {
  picks: Picks;
  tiebreak: string;
}

const readDraft = (key: string): Draft | null => {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const { picks, tiebreak } = parsed as Partial<Draft>;
    if (typeof picks !== "object" || picks === null) return null;
    // Trusted only as far as its shape: this is a string a user can edit in
    // devtools, and a bad `choice` would be a POST the RPC rejects with an
    // error the player did nothing to earn.
    const clean: Picks = {};
    for (const [id, side] of Object.entries(picks)) {
      if (side === "away" || side === "home") clean[id] = side;
    }
    return { picks: clean, tiebreak: typeof tiebreak === "string" ? tiebreak : "" };
  } catch {
    // Private mode, a full quota, or somebody's JSON. None of them are worth an
    // error on a screen whose job is sixteen taps.
    return null;
  }
};

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
  index,
  hit,
  tz,
  pick,
  onPick,
}: {
  game: Game;
  /** Its place in the jornada, 1-based. "RETO 03" is how the mockups name it. */
  index: number;
  /** What an accurate pick is worth, straight from the programme's mechanics. */
  hit: number;
  tz: string;
  pick: Side | undefined;
  onPick: (gameId: string, side: Side) => void;
}) {
  const away = teamOf(game.away);
  const home = teamOf(game.home);

  const side = (which: Side, team: typeof away, abbr: string) => (
    <button
      type="button"
      className={`pk-side${pick === which ? " is-picked" : ""}`}
      style={{ "--team": team.color } as React.CSSProperties}
      onClick={() => onPick(game.id, which)}
      aria-pressed={pick === which}
      aria-label={`Elegir ${team.name}`}
    >
      {pick === which ? <span className="pk-side-stamp">Tu pick</span> : null}
      <TeamMark abbr={abbr} />
      <span className="pk-side-name">{team.name}</span>
      <span className="pk-side-city">{team.city}</span>
    </button>
  );

  return (
    <div className="pk-match">
      <div className="pk-match-head">
        <span className="pk-match-no">Reto {String(index).padStart(2, "0")}</span>
        {/* Kickoff first and the broadcaster after it, in that order and in one
            ellipsizing cell: when the bar runs out of room the tail is what
            gets cut, and the tail is the least load-bearing half. */}
        <span className="pk-match-when">
          {formatKickoff(game.kickoffAt, tz)}
          {game.venueNote || game.network ? ` · ${game.venueNote || game.network}` : ""}
        </span>
        <span className="pk-match-pts">+{hit} pts</span>
      </div>
      <div className="pk-match-body">
        {side("away", away, game.away)}
        <div className="pk-at">
          <span className="pk-vs">VS</span>
          <span className="pk-at-hint">elige uno</span>
        </div>
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
  charDir,
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
  /** Where this tenant's cast lives, or null when it has none. */
  charDir: string | null;
}) {
  const router = useRouter();
  const [picks, setPicks] = useState<Picks>(initialPicks);
  const [tiebreak, setTiebreak] = useState<string>(
    initialTiebreak === null ? "" : String(initialTiebreak),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * The sheet as the SERVER last saw it, or null if it never saw one.
   *
   * This replaces a plain `saved` boolean that `onPick` cleared blindly. The
   * boolean could not tell "I tapped a side and changed nothing" from "I have
   * an edit worth saving", so tapping the already-picked team turned a saved
   * sheet back into an unsaved one and put the primary button back on screen
   * with nothing for it to do. A snapshot answers the real question: does what
   * is on screen differ from what is stored.
   *
   * Seeded from the server's copy when the week was already submitted, which is
   * why coming back to a finished sheet shows no bar at all rather than an
   * "Enviar mis picks" that would re-send the same sixteen picks.
   */
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(
    Object.keys(initialPicks).length > 0
      ? snapshotOf(initialPicks, initialTiebreak === null ? "" : String(initialTiebreak))
      : null,
  );

  /**
   * The celebration, and what it should say. Null while there is nothing to
   * celebrate.
   *
   * `early` is frozen in here at the instant the POST came back rather than
   * read on render: `submit` calls `router.refresh()` straight after, and a
   * sheet sent seconds before the early window closed would otherwise announce
   * the bonus and then take it back.
   */
  const [celebration, setCelebration] = useState<{
    count: number;
    early: boolean;
  } | null>(null);

  const playable = useMemo(() => games.filter((g) => !g.voided), [games]);

  const key = draftKey(slug, week);

  /**
   * Restoring a draft, AFTER mount and never during render.
   *
   * `localStorage` does not exist on the server, so seeding `useState` from it
   * would render one tree on the server and a different one in the browser —
   * the hydration mismatch React resolves by throwing the client's markup away.
   * An effect runs after the first paint, when the two trees already agree.
   *
   * The server's copy wins where both have an opinion: a saved sheet is a fact
   * and a draft is an intention, but a draft that ADDS picks to a saved sheet
   * is the player's own edit and is kept. That is why this merges rather than
   * replaces — and why merging makes the board dirty, which is correct: the
   * screen and the server genuinely disagree, and the bar says so.
   */
  useEffect(() => {
    const draft = readDraft(key);
    if (!draft) return;
    // `react-hooks/set-state-in-effect` is silenced here on purpose, and its own
    // text says why: an effect may "subscribe for updates from some external
    // system". localStorage is that system, and reading it any earlier — in a
    // lazy `useState` initialiser, say — is precisely the hydration mismatch
    // this arrangement exists to avoid, because the server has no such store.
    // It runs once per week key and settles in one extra render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPicks((prev) => ({ ...prev, ...draft.picks }));
    setTiebreak((prev) => (prev === "" ? draft.tiebreak : prev));
  }, [key]);

  // Skips the very first flush, which would otherwise write the props back over
  // a draft the effect above has read but not yet committed to state.
  const hydrated = useRef(false);

  useEffect(() => {
    if (!hydrated.current) {
      hydrated.current = true;
      return;
    }
    try {
      window.localStorage.setItem(key, JSON.stringify({ picks, tiebreak }));
    } catch {
      // Quota, private mode, a browser that says no. The draft is a courtesy;
      // failing to store one may not cost anybody a pick.
    }
  }, [key, picks, tiebreak]);

  // Stable across renders, so `memo` on the row actually holds. It does NOT
  // touch the saved state any more — see `savedSnapshot`.
  const onPick = useCallback((gameId: string, side: Side) => {
    setPicks((prev) => (prev[gameId] === side ? prev : { ...prev, [gameId]: side }));
  }, []);

  const chosen = playable.filter((g) => picks[g.id]).length;
  const missing = playable.length - chosen;
  const complete = missing === 0;
  const early = qualifiesEarly(lockAt, mechanics.earlyHours, new Date());

  const snapshot = snapshotOf(picks, tiebreak);
  const saved = savedSnapshot !== null;
  const dirty = saved && savedSnapshot !== snapshot;

  // The bar earns its ~64px only when there is something to press. A blank
  // sheet, or one already stored and untouched, gets the whole screen.
  const showBar = chosen > 0 && (!saved || dirty);

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
      setSavedSnapshot(snapshot);
      setSaving(false);

      // The draft has served its purpose: the sheet is on the server now, and a
      // stale copy in localStorage would come back as "cambios sin guardar" on
      // the next visit.
      try {
        window.localStorage.removeItem(key);
      } catch {
        /* see the write effect */
      }

      // `early` frozen here rather than read in the modal: `router.refresh()`
      // below re-renders, and a sheet sent seconds before the window closed
      // would otherwise announce the bonus and then withdraw it.
      setCelebration({ count: chosen, early });

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
          {/* The character that comes with the state of the board: the referee
              while the sheet is blank, the one with the clipboard once picks
              are on it. Both are in the approved set for this screen, and which
              one is standing there is the fastest read of "have I started". */}
          <div className="pk-titlerow">
            <div>
              <span className="pk-tag">
                Reto de la jornada {week}
              </span>
              <h1 className="sg-display" style={{ marginTop: 10 }}>
                Arma tu quiniela
              </h1>
              <p className="sg-body" style={{ marginTop: 8, marginBottom: 0 }}>
                {chosen === 0
                  ? `${playable.length} partidos · +${mechanics.hit} pts por acierto`
                  : `${chosen} pick${chosen === 1 ? "" : "s"} hecho${chosen === 1 ? "" : "s"} · +${mechanics.hit} pts por acierto`}
                {lockAt ? ` · cierra el ${formatKickoff(lockAt, tz)}` : ""}
              </p>
            </div>
            <ChapaCharacter
              dir={charDir}
              name={chosen === 0 ? "cebra-picks" : "dino-picks"}
              size={118}
            />
          </div>

          {/* Progress as a number on a yellow bar, the way the mockups show it.
              It is what people check before deciding whether they have time to
              finish now. */}
          <div
            className="pk-progress"
            role="progressbar"
            aria-valuenow={chosen}
            aria-valuemin={0}
            aria-valuemax={playable.length}
            aria-label="Picks elegidos"
          >
            <div
              className="pk-progress-fill"
              style={{ width: `${playable.length ? (chosen / playable.length) * 100 : 0}%` }}
            />
            <span className="pk-progress-n">
              {chosen} / {playable.length}
            </span>
          </div>

          {strip}
          {checkin}

          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {playable.map((g, i) => (
              <MatchRow
                key={g.id}
                game={g}
                index={i + 1}
                hit={mechanics.hit}
                tz={tz}
                pick={picks[g.id]}
                onPick={onPick}
              />
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
                onChange={(e) => setTiebreak(e.target.value.replace(/\D/g, "").slice(0, 3))}
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
            <div className="pk-ticket pk-mech is-on">
              <span className="pk-mech-disc" aria-hidden="true">
                ⏱
              </span>
              <div className="pk-mech-text">
                <div className="pk-mech-name">Madrugador</div>
                <div className="pk-mech-sub">
                  Envías con más de {mechanics.earlyHours} h de anticipación
                </div>
              </div>
              <div className="pk-perf" />
              <div className="pk-mech-val">+{mechanics.early}</div>
            </div>
          ) : null}

          {/* This used to be a permanent line in the dock. It is reassurance,
              not instruction — nobody needs it before they have picked
              anything, and after saving the celebration says it again at the
              moment it matters. In the scroll it costs nothing. */}
          <p className="sg-foot" style={{ margin: 0, textAlign: "center" }}>
            Los puedes cambiar hasta el primer kickoff.
            {saved && !dirty ? " Tus picks ya están guardados." : ""}
          </p>
        </div>
      </div>

      {/* The one contextual control the module has, and it appears only when
          there is something to press. The old dock was three stacked buttons
          plus a caption — ~165px welded to the bottom of every visit, two of
          them duplicating what are tabs now. */}
      {showBar ? (
        <div className="pk-dockmini">
          {error ? <div className="sg-error">{error}</div> : null}
          {dirty ? <span className="pk-dirty">Cambios sin guardar</span> : null}
          <button className="sg-btn" onClick={submit} disabled={!complete || saving || !live}>
            {!live
              ? "Vista previa"
              : saving
                ? "Guardando…"
                : !complete
                  ? `Faltan ${missing} pick${missing === 1 ? "" : "s"}`
                  : dirty
                    ? "Guardar cambios"
                    : "Enviar mis picks"}
          </button>
        </div>
      ) : null}

      {celebration ? (
        <SavedCelebration
          slug={slug}
          week={week}
          count={celebration.count}
          total={playable.length}
          early={celebration.early}
          earlyPoints={mechanics.early}
          charDir={charDir}
          onClose={() => setCelebration(null)}
        />
      ) : null}
    </>
  );
}

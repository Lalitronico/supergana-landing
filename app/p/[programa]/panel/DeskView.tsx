"use client";

import { useState, useSyncExternalStore } from "react";
import type { AwardLookup, PanelProgram, PanelStaff, WeekAward } from "./types";

/**
 * The counter. Where the game turns into a visit.
 *
 * The player shows the code on their phone, somebody behind the counter types
 * it, and the prize is handed over. That moment is the whole mechanism of the
 * business — the game lives on the phone, the prize brings them back to the
 * table — which is why no prize on this platform is ever collected online.
 *
 * Two steps on purpose, never one. The lookup says what the code IS before
 * anybody promises anything, and only then is there a button that spends it. A
 * single button that searched and redeemed at once would burn a mistyped code
 * belonging to somebody else before the cashier could read the name on it.
 *
 * NOTHING HERE INTERPRETS THE CODE. Not the normalisation, not even whether it
 * is long enough to be one: the screen sends what was typed and the server
 * answers. That is deliberate — the match lives in `pickem_find_award`, which
 * normalises exactly as `pickem_redeem_award` does, and a browser-side copy of
 * that rule is a second rule that can disagree. A code the panel refuses to
 * look up and the counter would have accepted is, from the customer's side,
 * indistinguishable from a prize that does not exist.
 *
 * The verdict is a colour before it is a sentence: a cashier reads it at arm's
 * length with somebody waiting.
 */

const STATUS_LABEL: Record<string, string> = {
  pending: "Por canjear",
  redeemed: "Ya canjeado",
  expired: "Vencido",
  canceled: "Cancelado",
};

const venueKey = (slug: string) => `sg:pickem:panel:venue:${slug}`;

/** localStorage does not change under us during a shift; nothing to subscribe to. */
const NO_SUBSCRIPTION = () => () => {};

export function DeskView({
  slug,
  program,
  staff,
  pending,
  onDone,
}: {
  slug: string;
  program: PanelProgram;
  staff: PanelStaff;
  pending: WeekAward[];
  onDone: (message: string, bad?: boolean) => void | Promise<void>;
}) {
  const [code, setCode] = useState("");
  const [award, setAward] = useState<AwardLookup | null>(null);
  /** "searched and found nothing" — distinct from "have not searched yet". */
  const [missing, setMissing] = useState<"none" | "not-found" | "incomplete">("none");
  const [busy, setBusy] = useState<"find" | "redeem" | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * The branch remembers itself.
   *
   * The tablet lives at one counter and stays signed in all day. Making
   * somebody pick the sucursal on every redemption is how the wrong one ends up
   * stamped on a prize at the end of a shift — and `redeemed_venue` is what the
   * tenant's per-branch report is built out of.
   *
   * Read through `useSyncExternalStore` rather than seeded from an effect.
   * localStorage IS an external store, the server has no answer for it, and the
   * server snapshot says so — which is what keeps the first paint from claiming
   * a branch the server could not know about. Seeding it with a setState inside
   * an effect would be a cascading render for a value that is already available
   * synchronously in the browser.
   */
  const stored = useSyncExternalStore(
    NO_SUBSCRIPTION,
    () => {
      try {
        return window.localStorage.getItem(venueKey(slug)) ?? "";
      } catch {
        // A tablet with storage disabled. Only the memory is lost.
        return "";
      }
    },
    () => "",
  );

  /** Null until somebody picks; the remembered branch stands in until then. */
  const [picked, setPicked] = useState<string | null>(null);
  const venue =
    picked ?? (stored || (program.venues.length === 1 ? program.venues[0] : ""));

  const chooseVenue = (next: string) => {
    setPicked(next);
    try {
      window.localStorage.setItem(venueKey(slug), next);
    } catch {
      // As above.
    }
  };

  const reset = () => {
    setCode("");
    setAward(null);
    setMissing("none");
    setError(null);
  };

  const find = async (typed = code) => {
    setBusy("find");
    setError(null);
    setAward(null);
    setMissing("none");
    try {
      const res = await fetch(
        `/api/pickem/${slug}/panel/canje/?code=${encodeURIComponent(typed)}`,
        { cache: "no-store" },
      );
      const json = (await res.json().catch(() => ({}))) as {
        award?: AwardLookup | null;
        incomplete?: boolean;
        message?: string;
      };
      if (!res.ok) {
        setError(json.message ?? "No pudimos buscar el código.");
        return;
      }
      if (json.award) {
        setAward(json.award);
        return;
      }
      setMissing(json.incomplete ? "incomplete" : "not-found");
    } catch {
      setError("Se cayó la conexión. Intenta de nuevo.");
    } finally {
      setBusy(null);
    }
  };

  const redeem = async () => {
    if (!award) return;
    setBusy("redeem");
    setError(null);
    try {
      const res = await fetch(`/api/pickem/${slug}/panel/canje/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: award.code, venue }),
      });
      const json = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) {
        setError(json.message ?? "No pudimos canjear el código.");
        // The state may have moved under the cashier — somebody at another
        // branch may have redeemed it a minute ago. Re-read rather than leave a
        // stale card on screen with a live button under it.
        await find(award.code);
        return;
      }
      await onDone(json.message ?? "Canjeado.");
      reset();
    } catch {
      setError("Se cayó la conexión. Intenta de nuevo.");
    } finally {
      setBusy(null);
    }
  };

  // The stored status can lag the calendar: a pending award past its deadline
  // is expired in fact whether or not anybody ran the update. The server sends
  // both facts so the counter is never told to hand over something it should
  // refuse.
  const claimable = award !== null && award.status === "pending" && !award.expired;
  const needsVenue = venue.trim().length === 0;

  const stamp = (iso: string) =>
    new Date(iso).toLocaleString("es-MX", {
      dateStyle: "long",
      timeStyle: "short",
      timeZone: program.timezone,
    });

  return (
    <>
      <div className="sg-card">
        <div className="pkp-title">Caja de canje</div>
        <p className="sg-foot" style={{ marginTop: 4 }}>
          Pide el código en la pantalla del jugador. No importan mayúsculas ni guiones.
        </p>

        <input
          className="pkp-code"
          style={{ marginTop: 12 }}
          type="text"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          placeholder="CHA-W3-K7M2QX"
          aria-label="Código del premio"
          maxLength={40}
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            setAward(null);
            setMissing("none");
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && code.trim()) void find();
          }}
        />

        <div className="pkp-inline" style={{ marginTop: 10 }}>
          <button
            className="sg-btn"
            disabled={busy !== null || !code.trim()}
            onClick={() => void find()}
          >
            {busy === "find" ? "Buscando…" : "Buscar código"}
          </button>
          {(award || missing !== "none") && (
            <button
              className="sg-btn ghost"
              style={{ width: "auto", flex: "none", padding: "14px 16px" }}
              onClick={reset}
            >
              Limpiar
            </button>
          )}
        </div>

        {error && <p className="sg-error" style={{ marginTop: 10 }}>{error}</p>}
      </div>

      {missing === "incomplete" && (
        <div className="pkp-verdict wait">
          <div className="big">Código incompleto</div>
          <div style={{ fontSize: 13, lineHeight: 1.45 }}>
            Falta parte del código. Son tres bloques: la marca, la jornada y seis
            caracteres.
          </div>
        </div>
      )}

      {missing === "not-found" && (
        <div className="pkp-verdict bad">
          <div className="big">Código no encontrado</div>
          <div style={{ fontSize: 13, lineHeight: 1.45 }}>
            No existe en este programa. Revisa que esté completo y que el jugador esté
            mostrando el código de <b>{program.name}</b>.
          </div>
        </div>
      )}

      {award && (
        <>
          <div
            className={`pkp-verdict ${
              claimable ? "ok" : award.status === "redeemed" ? "bad" : "wait"
            }`}
          >
            <div className="big">
              {claimable
                ? "Válido — entrégalo"
                : award.status === "redeemed"
                  ? "Ya fue canjeado"
                  : award.status === "canceled"
                    ? "Premio cancelado"
                    : "Código vencido"}
            </div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{award.prize}</div>
            {award.detail && <div style={{ fontSize: 13 }}>{award.detail}</div>}
          </div>

          <div className="sg-card">
            <div className="pkp-row">
              <div className="body">
                <div className="name">{award.alias}</div>
                <div className="sub">
                  {award.week ? `Jornada ${award.week}` : "Premio de temporada"} · lugar{" "}
                  {award.place}
                </div>
              </div>
              <span className="sg-pill">{STATUS_LABEL[award.status] ?? award.status}</span>
            </div>

            <div className="pkp-row">
              <div className="body">
                <div className="sub">Código</div>
                <div className="name pkp-mono">{award.code}</div>
              </div>
            </div>

            <div className="pkp-row">
              <div className="body">
                <div className="sub">Vigencia</div>
                <div className="name">
                  {stamp(award.expiresAt)}
                  {award.expired ? " · vencida" : ""}
                </div>
              </div>
            </div>

            {award.redeemedAt && (
              <div className="pkp-row">
                <div className="body">
                  <div className="sub">Entregado</div>
                  <div className="name">
                    {stamp(award.redeemedAt)}
                    {award.redeemedVenue ? ` · ${award.redeemedVenue}` : ""}
                  </div>
                </div>
              </div>
            )}
          </div>

          {claimable && staff.canRedeem && (
            <div className="sg-card">
              <div className="sg-field">
                <label htmlFor="pkp-venue">Sucursal donde se entrega</label>
                {program.venues.length > 0 ? (
                  <select
                    id="pkp-venue"
                    value={venue}
                    onChange={(e) => chooseVenue(e.target.value)}
                  >
                    <option value="">Elige la sucursal…</option>
                    {program.venues.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id="pkp-venue"
                    type="text"
                    value={venue}
                    placeholder="Nombre de la sucursal"
                    onChange={(e) => chooseVenue(e.target.value)}
                  />
                )}
              </div>

              <button
                className="sg-btn"
                style={{ marginTop: 12 }}
                disabled={busy !== null || needsVenue}
                onClick={() => void redeem()}
              >
                {busy === "redeem" ? "Registrando…" : "Confirmar entrega"}
              </button>

              <p className="sg-foot" style={{ marginTop: 8 }}>
                Queda registrado con la hora, la sucursal y tu cuenta. Es lo que permite
                responder “¿ya usó su premio?” sin que nadie tenga que acordarse.
              </p>
            </div>
          )}

          {claimable && !staff.canRedeem && (
            <p className="sg-foot">Tu rol no puede marcar entregas.</p>
          )}
        </>
      )}

      {/* ---- what is out there ---------------------------------------- */}
      <div className="sg-card">
        <div className="pkp-title">Premios por canjear</div>
        {pending.length === 0 ? (
          <p className="sg-body" style={{ marginTop: 6 }}>
            No hay premios pendientes en este momento.
          </p>
        ) : (
          pending.map((a) => (
            <div key={a.id} className="pkp-row">
              <div className="body">
                <div className="name">{a.alias}</div>
                <div className="sub pkp-mono">{a.code}</div>
                <div className="sub">
                  {a.prizeName} · vence{" "}
                  {new Date(a.expiresAt).toLocaleDateString("es-MX", {
                    day: "numeric",
                    month: "short",
                    timeZone: program.timezone,
                  })}
                </div>
              </div>
              <button
                type="button"
                className="sg-btn ghost sm"
                style={{ width: "auto", flex: "none" }}
                onClick={() => {
                  setCode(a.code);
                  setAward(null);
                  setMissing("none");
                  setError(null);
                  void find(a.code);
                }}
              >
                Abrir
              </button>
            </div>
          ))
        )}
      </div>
    </>
  );
}

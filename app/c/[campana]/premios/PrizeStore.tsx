"use client";

import { useState } from "react";
import { REDEMPTION_STATUS_KEY } from "@/lib/tickets/i18n";
import {
  prizeName,
  REDEEM_ERROR_KEY,
  type PrizeKind,
  type RedemptionStatus,
  type StorePrize,
} from "@/lib/tickets/store";
import { Mascot } from "../Mascot";
import { useStoreState, useTickets } from "../TicketsShell";
import { ConfirmRedeem } from "./ConfirmRedeem";
import { PrizeIcon } from "./PrizeIcon";
import { RedemptionCode } from "./RedemptionCode";

const REDEMPTION_PILL: Record<RedemptionStatus, string> = {
  confirmed: "wait",
  fulfilled: "ok",
  canceled: "bad",
};

interface FreshCode {
  code: string;
  prize: string;
  kind: PrizeKind;
}

/**
 * One prize on the shelf.
 *
 * The stamp is the whole point of the card: from across the room somebody should
 * know whether this is theirs today, nearly theirs, or gone until Monday. All
 * three states stay visible — hiding the sold-out one would hide the fact that
 * the Drop is real and moves fast, which is the reason to come back on Monday.
 */
function PrizeCard({
  prize,
  points,
  featured,
  onPick,
}: {
  prize: StorePrize;
  points: number;
  featured: boolean;
  onPick: () => void;
}) {
  const { locale, t } = useTickets();
  const soldOut = prize.remaining <= 0;
  const short = points < prize.pointsCost;
  const missing = prize.pointsCost - points;
  const pct =
    prize.pointsCost > 0
      ? Math.min(100, Math.round((points / prize.pointsCost) * 100))
      : 100;
  const fmt = (n: number) => n.toLocaleString(locale === "en" ? "en-US" : "es-MX");

  // "Almost" is a claim, so it needs a threshold rather than a feeling. Half the
  // cost already earned is the point where the next receipt plausibly closes the
  // gap, which is when telling somebody they are close is encouragement instead
  // of a taunt.
  const almost = short && !soldOut && pct >= 50;

  return (
    <div
      className={["tk-prize", featured ? "featured" : null, soldOut ? "gone" : null]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="tk-prize-stamps">
        {featured && !soldOut && <span className="tk-badge brand">{t("stFeatured")}</span>}
        {soldOut ? (
          <span className="tk-stamp gone">{t("stSoldOut")}</span>
        ) : almost ? (
          <span className="tk-stamp almost">{t("stAlmost")}</span>
        ) : !short ? (
          <span className="tk-stamp ok">{t("stAvailable")}</span>
        ) : null}
      </div>

      <PrizeIcon kind={prize.kind} className={featured ? "big" : undefined} />

      <div className="tk-prize-body">
        <b className="tk-prize-name">{prizeName(prize, locale)}</b>

        <span className="tk-prize-cost">
          <span className="tk-star" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path
                d="m12 2.6 2.9 6.05 6.6.86-4.85 4.55 1.24 6.54L12 17.4l-5.89 3.2 1.24-6.54L2.5 9.51l6.6-.86z"
                fill="var(--tk-yellow)"
                stroke="var(--tk-ink)"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          {t("stCost", { points: fmt(prize.pointsCost) })}
        </span>

        {/* The exact count, always — Eduardo's call. "Quedan 3" risks reading as
            a small campaign; a vague "few left" risks reading as a lie, and the
            inventory is restocked every Monday. */}
        <span className="tk-prize-stock">
          {soldOut ? t("stSoldOut") : t("stLeft", { left: prize.remaining })}
        </span>

        {short && !soldOut && (
          <>
            <div className="tk-progress">
              <div className="tk-progress-fill" style={{ width: `${pct}%` }} />
            </div>
            <span className="tk-prize-gap">
              {t("npMissingLead")} <b>{t("npMissingPts", { points: fmt(missing) })}</b>
            </span>
          </>
        )}
      </div>

      {soldOut ? (
        <button type="button" className="tk-btn sm" disabled>
          {t("stSoldOut")}
        </button>
      ) : short ? null : (
        <button type="button" className="tk-btn sm" onClick={onPick}>
          {t("stRedeem")}
        </button>
      )}
    </div>
  );
}

/**
 * The Prize Store: this week's Drop, and what the participant already claimed.
 *
 * Accumulation campaigns only — the endpoint answers 404 elsewhere, because a
 * threshold campaign has no balance to spend.
 *
 * Three things this screen refuses to lie about: how many units are left, that a
 * sold-out prize is gone until Monday, and that redeeming does not cost position
 * in the race. All three are the client's own rules.
 *
 * There is no countdown on the Drop, and that is deliberate: `prize_drops` has
 * no `ends_at` and a human closes it, so a clock ticking towards a moment nobody
 * guaranteed would be the one promise this module cannot keep. The cadence is
 * stated instead.
 */
export function PrizeStore({
  slug,
  onRedeemed,
}: {
  slug: string;
  /** Refreshes the shared session, which is what repaints the balance chip. */
  onRedeemed: () => void;
}) {
  const { campaign, locale, t } = useTickets();
  // The shelf is read once, in the shell: the next-prize bar on the home and in
  // Mi panel read the same snapshot, and two fetches would mean two answers
  // about how many units are left.
  const { status, snapshot, reload: load } = useStoreState();
  const [confirming, setConfirming] = useState<StorePrize | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** The code just won. Takes over the screen until the participant leaves it. */
  const [fresh, setFresh] = useState<FreshCode | null>(null);

  const redeem = async (prize: StorePrize) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/tickets/${slug}/store/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dropItemId: prize.id }),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        error?: string;
        redemption?: { redemption_code?: string };
      };
      if (!res.ok) {
        setError(t(REDEEM_ERROR_KEY[payload.error ?? ""] ?? "errGeneric"));
        // Whatever the refusal was — sold out, drop closed — the screen the
        // participant is looking at is already out of date. Re-read it.
        await load();
        return;
      }
      setConfirming(null);
      setFresh({
        code: payload.redemption?.redemption_code ?? "—",
        prize: prizeName(prize, locale),
        kind: prize.kind,
      });
      await load();
      onRedeemed();
    } catch {
      setError(t("errNetwork"));
    } finally {
      setBusy(false);
    }
  };

  // Nothing rendered while the first read is in flight: a skeleton that resolves
  // to "no drop" is worse than silence.
  if (status === "loading" || status === "off") return null;

  if (status === "unavailable" || snapshot?.available === false) {
    return (
      <div className="tk-card">
        <h2 className="tk-h" style={{ fontSize: 18, marginBottom: 6 }}>{t("stTitle")}</h2>
        <p className="tk-body" style={{ fontSize: 13.5 }}>{t("stUnavailable")}</p>
      </div>
    );
  }

  const drop = snapshot?.drop ?? null;
  const points = snapshot?.points ?? 0;
  const redemptions = snapshot?.redemptions ?? [];

  // The payoff gets the screen to itself. Same route, different state: the flow
  // is unchanged, but a won code competing with a grid of other prizes is not a
  // payoff.
  if (fresh) {
    return (
      <RedemptionCode
        code={fresh.code}
        prize={fresh.prize}
        kind={fresh.kind}
        onBack={() => setFresh(null)}
      />
    );
  }

  // Cheapest first, as the API sends them, so the featured prize is the one most
  // people can actually reach rather than the most expensive thing on the shelf.
  const items = drop?.items ?? [];
  const featured = items.find((item) => item.remaining > 0) ?? items[0] ?? null;
  const rest = featured ? items.filter((item) => item.id !== featured.id) : items;
  const allGone = items.length > 0 && items.every((item) => item.remaining <= 0);

  return (
    <>
      {confirming && (
        <ConfirmRedeem
          prize={confirming}
          points={points}
          busy={busy}
          error={error}
          onConfirm={() => void redeem(confirming)}
          onCancel={() => {
            setConfirming(null);
            setError(null);
          }}
        />
      )}

      <div className="tk-drophead">
        <div>
          <h1 className="tk-h" style={{ fontSize: 27 }}>{t("stTitle")}</h1>
          <p className="tk-foot" style={{ marginTop: 4 }}>{t("stDropCadence")}</p>
        </div>
        {campaign.theme.mascots.ticket && (
          <div className="tk-drophead-art">
            <Mascot pose="ticket" />
          </div>
        )}
      </div>

      {/* Errors from a refusal that happened outside the modal — a stale shelf
          re-read, mostly. Inside the modal the modal shows them. */}
      {error && !confirming && <p className="tk-error">{error}</p>}

      {items.length === 0 ? (
        <div className="tk-card">
          <p className="tk-body" style={{ fontSize: 13.5 }}>{t("stNoDrop")}</p>
          <p className="tk-foot" style={{ marginTop: 6 }}>{t("stNoDropNote")}</p>
        </div>
      ) : (
        <>
          {featured && (
            <PrizeCard
              prize={featured}
              points={points}
              featured
              onPick={() => {
                setError(null);
                setConfirming(featured);
              }}
            />
          )}

          {rest.length > 0 && (
            <div className="tk-prizegrid">
              {rest.map((prize) => (
                <PrizeCard
                  key={prize.id}
                  prize={prize}
                  points={points}
                  featured={false}
                  onPick={() => {
                    setError(null);
                    setConfirming(prize);
                  }}
                />
              ))}
            </div>
          )}

          {allGone && <p className="tk-foot">{t("stSoldOutNote")}</p>}
        </>
      )}

      {redemptions.length > 0 && (
        <div className="tk-card">
          <h2 className="tk-h" style={{ fontSize: 18, marginBottom: 4 }}>{t("stHistTitle")}</h2>
          <div className="tk-hist">
            {redemptions.map((row) => (
              <div className="tk-hist-item" key={row.id}>
                <div className="meta">
                  <b>{prizeName({ nameEs: row.prizeNameEs, nameEn: row.prizeNameEn }, locale)}</b>
                  <span>
                    {t("stRedeemedOn", {
                      date: new Intl.DateTimeFormat(locale === "es" ? "es-MX" : "en-US", {
                        day: "numeric",
                        month: "short",
                      }).format(new Date(row.createdAt)),
                    })}{" "}
                    · {row.pointsSpent} {t("pointsUnit")}
                  </span>
                  {/* Monospaced and letter-spaced: this is the string somebody
                      reads out at a counter, in a list that may hold several. */}
                  <span className="tk-histcode">{row.code}</span>
                </div>
                <span className={`tk-pill ${REDEMPTION_PILL[row.status]}`}>
                  {t(REDEMPTION_STATUS_KEY[row.status])}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

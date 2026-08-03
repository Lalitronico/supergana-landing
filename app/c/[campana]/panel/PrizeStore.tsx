"use client";

import { useCallback, useEffect, useState } from "react";
import { REDEMPTION_STATUS_KEY } from "@/lib/tickets/i18n";
import {
  prizeName,
  REDEEM_ERROR_KEY,
  type RedemptionStatus,
  type StorePrize,
  type StoreSnapshot,
} from "@/lib/tickets/store";
import { useTickets } from "../TicketsShell";

const REDEMPTION_PILL: Record<RedemptionStatus, string> = {
  confirmed: "wait",
  fulfilled: "ok",
  canceled: "bad",
};

/**
 * The Prize Store: this week's Drop, and what the participant already claimed.
 *
 * Accumulation campaigns only — the panel decides that, because a threshold
 * campaign has no balance to spend and its endpoint answers 404.
 *
 * Three things this screen refuses to lie about: how many units are left, that
 * a sold-out prize is gone until Monday, and that redeeming does not cost
 * position in the race. All three are the client's own rules.
 */
export function PrizeStore({
  slug,
  onRedeemed,
}: {
  slug: string;
  /** Refreshes the panel's balance — the points card is upstream of this one. */
  onRedeemed: () => void;
}) {
  const { locale, t } = useTickets();
  const [snapshot, setSnapshot] = useState<StoreSnapshot | null>(null);
  const [failed, setFailed] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** The code just won, shown large until the participant navigates away. */
  const [fresh, setFresh] = useState<{ code: string; prize: string } | null>(null);

  // Fetching and storing are split the way useMe splits them: the mount effect
  // only writes state from inside its own callback, so a slow response cannot
  // land on a panel the participant already left.
  const fetchSnapshot = useCallback(async (): Promise<StoreSnapshot | null> => {
    try {
      const res = await fetch(`/api/tickets/${slug}/store/`, { cache: "no-store" });
      // 404 here is the endpoint saying "no store in this campaign" — a
      // threshold campaign, or one whose store is not deployed. Same screen.
      if (!res.ok) return null;
      return (await res.json()) as StoreSnapshot;
    } catch {
      return null;
    }
  }, [slug]);

  const load = useCallback(async () => {
    const next = await fetchSnapshot();
    if (next) setSnapshot(next);
    else setFailed(true);
  }, [fetchSnapshot]);

  useEffect(() => {
    let alive = true;
    fetchSnapshot().then((next) => {
      if (!alive) return;
      if (next) setSnapshot(next);
      else setFailed(true);
    });
    return () => {
      alive = false;
    };
  }, [fetchSnapshot]);

  const redeem = async (prize: StorePrize) => {
    setBusy(prize.id);
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
      });
      await load();
      onRedeemed();
    } catch {
      setError(t("errNetwork"));
    } finally {
      setBusy(null);
    }
  };

  // Nothing rendered while the first read is in flight: the store is the third
  // card down, and a skeleton that resolves to "no drop" is worse than silence.
  if (!snapshot && !failed) return null;

  if (failed || snapshot?.available === false) {
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

  return (
    <>
      {fresh && (
        <div className="tk-ticket">
          <div className="top" style={{ textAlign: "center", padding: "22px 18px" }}>
            <div className="tk-eyebrow">{t("stCodeTitle")}</div>
            <div
              className="tk-amount"
              style={{ letterSpacing: "0.14em", fontVariantLigatures: "none" }}
            >
              {fresh.code}
            </div>
            <p style={{ fontSize: 13, fontWeight: 700, marginTop: 6 }}>{fresh.prize}</p>
          </div>
          <div className="rip" />
          <div className="bottom">
            <p style={{ fontSize: 13, lineHeight: 1.45, fontWeight: 600 }}>{t("stCodeNote")}</p>
          </div>
        </div>
      )}

      <div className="tk-card">
        <h2 className="tk-h" style={{ fontSize: 18, marginBottom: 4 }}>{t("stTitle")}</h2>
        <p className="tk-foot">{t("stSub")}</p>

        {error && <p className="tk-error">{error}</p>}

        {!drop || drop.items.length === 0 ? (
          <>
            <p className="tk-body" style={{ fontSize: 13.5, marginTop: 10 }}>{t("stNoDrop")}</p>
            <p className="tk-foot" style={{ marginTop: 6 }}>{t("stNoDropNote")}</p>
          </>
        ) : (
          <div className="tk-hist" style={{ marginTop: 12 }}>
            {drop.items.map((prize) => {
              const soldOut = prize.remaining <= 0;
              const short = points < prize.pointsCost;
              const isConfirming = confirming === prize.id;
              return (
                <div
                  className="tk-hist-item"
                  key={prize.id}
                  style={{
                    alignItems: isConfirming ? "flex-start" : "center",
                    // Sold out stays visible and goes quiet: hiding it would
                    // hide the fact that the Drop is real and moves fast.
                    opacity: soldOut ? 0.55 : 1,
                    flexWrap: "wrap",
                    gap: 8,
                  }}
                >
                  <div className="meta">
                    <b>{prizeName(prize, locale)}</b>
                    <span>
                      {t("stCost", { points: prize.pointsCost })} ·{" "}
                      {soldOut ? t("stSoldOut") : t("stLeft", { left: prize.remaining })}
                    </span>
                    {isConfirming && (
                      <span style={{ marginTop: 4 }}>{t("stConfirmNote")}</span>
                    )}
                  </div>

                  {soldOut ? (
                    <span className="tk-pill">{t("stSoldOut")}</span>
                  ) : short ? (
                    <span className="tk-foot" style={{ whiteSpace: "nowrap" }}>
                      {t("stNeedMore", { points: prize.pointsCost - points })}
                    </span>
                  ) : isConfirming ? (
                    // Two steps on purpose: the points leave the balance the
                    // moment this lands, and there is no undo on this screen.
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        className="tk-btn sm"
                        disabled={busy === prize.id}
                        onClick={() => void redeem(prize)}
                      >
                        {busy === prize.id ? t("stRedeeming") : t("stConfirmYes")}
                      </button>
                      <button
                        type="button"
                        className="tk-linkbtn"
                        disabled={busy === prize.id}
                        onClick={() => setConfirming(null)}
                      >
                        {t("stConfirmNo")}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="tk-btn sm"
                      onClick={() => {
                        setError(null);
                        setConfirming(prize.id);
                      }}
                    >
                      {t("stRedeem")}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {drop && drop.items.every((p) => p.remaining <= 0) && drop.items.length > 0 && (
          <p className="tk-foot" style={{ marginTop: 10 }}>{t("stSoldOutNote")}</p>
        )}
      </div>

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
                    · {row.pointsSpent} pts
                  </span>
                  <span style={{ letterSpacing: "0.12em", fontWeight: 800 }}>{row.code}</span>
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

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { RECEIPT_STATUS_KEY, REWARD_STATUS_KEY } from "@/lib/tickets/i18n";
import type { ReceiptStatus, RewardStatus } from "@/lib/tickets/config";
import { useTickets } from "../TicketsShell";
import { StatusTimeline } from "../StatusTimeline";
import { useMe, type MeReceipt } from "../useMe";

const RECEIPT_PILL: Record<ReceiptStatus, string> = {
  received: "wait",
  in_review: "wait",
  approved: "ok",
  rejected: "bad",
  needs_new_image: "info",
};

const REWARD_PILL: Record<RewardStatus, string> = {
  reserved: "wait",
  queued: "wait",
  sent: "ok",
  delivered: "ok",
  failed: "bad",
  canceled: "bad",
};

/**
 * The progress panel: balance, distance to the next prize, and the catalog.
 * Accumulation only — a prize here is reached, never raffled. That wording is
 * load-bearing (see the v2 brief's legal frame), not marketing copy.
 */
function PointsCard({ points }: { points: number }) {
  const { campaign, locale, t, base } = useTickets();
  const prizes = campaign.prizes;
  const prizeName = (p: (typeof prizes)[number]) => (locale === "es" ? p.nameEs : p.nameEn);
  const next = prizes.find((p) => p.points > points) ?? null;
  const pct = next ? Math.min(100, Math.round((points / next.points) * 100)) : 100;

  return (
    <div className="tk-card">
      <div className="tk-eyebrow">{t("ptsTitle")}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 6 }}>
        <span className="tk-amount" style={{ fontSize: 40 }}>{points}</span>
        <b style={{ fontFamily: "var(--tk-display)", fontSize: 14 }}>{t("ptsUnit")}</b>
      </div>

      {points === 0 && (
        <p className="tk-foot" style={{ marginTop: 8 }}>{t("ptsEmpty")}</p>
      )}

      {prizes.length > 0 && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
            <div className="tk-quota-track">
              <div className="tk-quota-fill" style={{ width: `${pct}%` }} />
            </div>
            <b style={{ fontFamily: "var(--tk-display)", fontSize: 13, whiteSpace: "nowrap" }}>
              {pct}%
            </b>
          </div>
          <p className="tk-foot" style={{ marginTop: 8 }}>
            {next
              ? t("ptsNext", { points: next.points - points, prize: prizeName(next) })
              : t("ptsAllDone")}
          </p>

          <div className="tk-hist" style={{ marginTop: 12 }}>
            {prizes.map((prize) => (
              <div className="tk-hist-item" key={prize.id}>
                <div className="meta">
                  <b>{prizeName(prize)}</b>
                  <span>{t("przAt", { points: prize.points })}</span>
                </div>
                {points >= prize.points && (
                  <span className="tk-pill ok">{t("przUnlocked")}</span>
                )}
              </div>
            ))}
          </div>
          <p className="tk-foot" style={{ marginTop: 10 }}>{t("przNote")}</p>
        </>
      )}

      <p className="tk-foot" style={{ marginTop: 8 }}>
        {t("ptsRate", { rate: campaign.pointsPerDollar })}
      </p>
      {points === 0 && (
        <Link href={`${base}subir/`} className="tk-btn sm" style={{ marginTop: 12 }}>
          {t("pnEmptyCta")} →
        </Link>
      )}
    </div>
  );
}

/**
 * Shown while a reward exists but the address it pays out to is unproven.
 * This is the wall the sign-up flow deliberately doesn't have: it stands
 * exactly where the participant has $20 waiting behind it.
 */
function VerifyEmailCard({
  slug,
  email,
  onVerified,
}: {
  slug: string;
  email: string;
  onVerified: () => void;
}) {
  const { t } = useTickets();
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const call = async (body: { code?: string }) => {
    const res = await fetch(`/api/tickets/${slug}/verify-email/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await res.json().catch(() => ({}))) as {
      error?: string; verified?: boolean;
    };
    return { ok: res.ok, payload };
  };

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      const { ok, payload } = await call({});
      if (!ok) {
        setError(t(payload.error === "cooldown" ? "errTooManyCodes" : "errGeneric"));
        return;
      }
      setSent(true);
    } catch {
      setError(t("errNetwork"));
    } finally {
      setBusy(false);
    }
  };

  const confirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setError(t("errVeCode"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { ok, payload } = await call({ code });
      if (!ok) {
        setError(
          t(
            payload.error === "bad_code"
              ? "errVeCode"
              : payload.error === "code_expired"
                ? "errVeExpired"
                : payload.error === "too_many_attempts"
                  ? "errVeAttempts"
                  : "errGeneric",
          ),
        );
        return;
      }
      onVerified();
    } catch {
      setError(t("errNetwork"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="tk-card yellow">
      <h2 className="tk-h" style={{ fontSize: 18, marginBottom: 8 }}>{t("veTitle")}</h2>
      <p style={{ fontSize: 13.5, lineHeight: 1.45, fontWeight: 600 }}>
        {t("veBody", { email })}
      </p>
      {error && <p className="tk-error">{error}</p>}
      {!sent ? (
        <button className="tk-btn sm" type="button" onClick={send} disabled={busy} style={{ marginTop: 6 }}>
          {busy ? t("authSending") : t("veSend")} →
        </button>
      ) : (
        <form onSubmit={confirm} style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 6 }}>
          <p className="tk-body" style={{ fontSize: 13.5 }}>{t("veSent")}</p>
          <input
            className="tk-otp"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder="——————"
            required
          />
          <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between" }}>
            <button className="tk-btn sm" type="submit" disabled={busy}>
              {busy ? t("authVerifying") : t("veConfirm")} →
            </button>
            <button type="button" className="tk-linkbtn" onClick={send} disabled={busy}>
              {t("authResend")}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export default function PanelPage() {
  const { campaign, locale, t, base, money } = useTickets();
  const router = useRouter();
  const { status, me, reload } = useMe(campaign.slug);

  useEffect(() => {
    if (status === "anon") router.replace(`${base}entrar/?next=panel`);
    if (status === "no-profile") router.replace(`${base}registro/`);
  }, [status, router, base]);

  if (status === "loading" || status === "anon" || status === "no-profile" || !me) {
    return <div className="tk-pad"><p className="tk-body">{t("loading")}</p></div>;
  }

  const dateFmt = new Intl.DateTimeFormat(locale === "es" ? "es-MX" : "en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const day = (iso: string) => dateFmt.format(new Date(iso));

  // Store and eligible spend only exist after a reviewer has typed them, so a
  // receipt that was rejected or bounced back has neither. Returns an empty
  // string in that case and the caller drops the line entirely.
  const detailOf = (receipt: MeReceipt) =>
    [receipt.store_name, receipt.eligible_cents != null ? money(receipt.eligible_cents) : null]
      .filter(Boolean)
      .join(" · ");

  const reward = me.rewards.find((r) => r.status !== "canceled") ?? null;
  const open = me.receipts.find(
    (r: MeReceipt) => r.status === "received" || r.status === "in_review",
  );

  const signOut = async () => {
    await supabaseBrowser().auth.signOut();
    router.replace(base);
    router.refresh();
  };

  return (
    <div className="tk-pad">
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 10 }}>
        <div>
          <h1 className="tk-h" style={{ fontSize: 30 }}>{t("pnTitle")}</h1>
          <p className="tk-foot" style={{ marginTop: 4 }}>
            {t("pnHello", { name: me.participant?.firstName ?? "" })} · {me.email}
          </p>
        </div>
      </div>

      <PointsCard points={me.points} />

      {reward && me.participant && !me.participant.emailVerified && (
        <VerifyEmailCard
          slug={campaign.slug}
          email={me.email}
          onVerified={reload}
        />
      )}

      {reward && (
        <div className="tk-ticket">
          <div className="top" style={{ textAlign: "center", padding: "22px 18px" }}>
            <div className="tk-eyebrow">{t("pnRewardTitle")}</div>
            <div className="tk-amount">{money(reward.amount_cents)}</div>
            <span
              className={`tk-pill ${REWARD_PILL[reward.status]}`}
              style={{ marginTop: 10 }}
            >
              {t(REWARD_STATUS_KEY[reward.status])}
            </span>
          </div>
          <div className="rip" />
          <div className="bottom">
            <p style={{ fontSize: 13, lineHeight: 1.45, fontWeight: 600 }}>
              {reward.status === "sent" || reward.status === "delivered"
                ? t("pnRewardSub")
                : t("pnRewardPending")}
            </p>
          </div>
        </div>
      )}

      {open && (
        <div className="tk-card">
          <h2 className="tk-h" style={{ fontSize: 18, marginBottom: 10 }}>{t("prcTitle")}</h2>
          <StatusTimeline status={open.status} />
        </div>
      )}

      {me.receipts.length === 0 ? (
        <div className="tk-card">
          <p className="tk-body">{t("pnEmpty")}</p>
          <Link href={`${base}subir/`} className="tk-btn" style={{ marginTop: 14 }}>
            {t("pnEmptyCta")} →
          </Link>
        </div>
      ) : (
        <div className="tk-card">
          <h2 className="tk-h" style={{ fontSize: 18, marginBottom: 4 }}>{t("pnHistTitle")}</h2>
          <div className="tk-hist">
            {me.receipts.map((receipt) => (
              <div className="tk-hist-item" key={receipt.id}>
                <div className="meta">
                  <b>{t("pnReceiptOn", { date: day(receipt.submitted_at) })}</b>
                  {/* What was on the receipt, once a reviewer has read it —
                      never the status. The pill beside this already carries the
                      status, and falling back to a status word here printed
                      "Recibido" next to a RECHAZADO pill. Nothing is better
                      than a contradiction. */}
                  {detailOf(receipt) && <span>{detailOf(receipt)}</span>}
                  {receipt.reject_reason && (
                    <span>{t("pnRejected", { reason: receipt.reject_reason })}</span>
                  )}
                </div>
                <span className={`tk-pill ${RECEIPT_PILL[receipt.status]}`}>
                  {t(RECEIPT_STATUS_KEY[receipt.status])}
                </span>
              </div>
            ))}
          </div>
          {!open && (
            <Link href={`${base}subir/`} className="tk-btn sm" style={{ marginTop: 14 }}>
              {t("pnUploadAnother")} →
            </Link>
          )}
        </div>
      )}

      <p className="tk-foot">{t("privacyNote")}</p>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
        {/* Also the migration path for OTP-era accounts that have no password
            yet: updateUser works from any signed-in session. */}
        <Link href={`${base}restablecer/`} className="tk-linkbtn">
          {t("pnChangePw")}
        </Link>
        <button type="button" className="tk-linkbtn" onClick={signOut}>
          {t("authSignOut")}
        </button>
      </div>
    </div>
  );
}

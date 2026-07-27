"use client";

import { useEffect } from "react";
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

export default function PanelPage() {
  const { campaign, locale, t, base, money } = useTickets();
  const router = useRouter();
  const { status, me } = useMe(campaign.slug);

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
                  <span>
                    {receipt.store_name ??
                      (receipt.eligible_cents != null
                        ? money(receipt.eligible_cents)
                        : t("stReceived"))}
                    {receipt.eligible_cents != null && receipt.store_name
                      ? ` · ${money(receipt.eligible_cents)}`
                      : ""}
                  </span>
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
          {!open && !reward && (
            <Link href={`${base}subir/`} className="tk-btn sm" style={{ marginTop: 14 }}>
              {t("pnUploadAnother")} →
            </Link>
          )}
        </div>
      )}

      <p className="tk-foot">{t("privacyNote")}</p>
      <button type="button" className="tk-linkbtn" onClick={signOut}>
        {t("authSignOut")}
      </button>
    </div>
  );
}

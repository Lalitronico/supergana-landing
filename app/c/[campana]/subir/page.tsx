"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";
import {
  ACCEPTED_IMAGE_TYPES,
  MAX_RECEIPT_BYTES,
  RECEIPTS_BUCKET,
} from "@/lib/tickets/config";
import { useTickets } from "../TicketsShell";
import { StatusTimeline } from "../StatusTimeline";
import { ApprovalCelebration } from "../ApprovalCelebration";
import { currentClaim, useMe } from "../useMe";

const EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

const API_ERROR_KEYS = {
  duplicate_image: "errDuplicateImage",
  receipt_pending: "errPendingReceipt",
  already_rewarded: "pnRewardedAlready",
  campaign_closed: "errClosed",
  image_too_large: "errFileSize",
  image_missing: "errGeneric",
  not_signed_in: "errNotSignedIn",
} as const;

export default function UploadPage() {
  const { campaign, t, base, money } = useTickets();
  const router = useRouter();
  const { status, me, reload } = useMe(campaign.slug);
  const fileInput = useRef<HTMLInputElement>(null);
  const previewRef = useRef<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Staff rehearsing a draft campaign can submit even though the public can't.
  const canSubmit = campaign.acceptsReceipts || (me?.canRehearse ?? false);

  useEffect(() => {
    if (status === "anon") router.replace(`${base}entrar/`);
    if (status === "no-profile") router.replace(`${base}registro/`);
  }, [status, router, base]);

  // Object URLs leak until revoked and this screen can cycle through several
  // photos, so the previous one is released the moment a new file is chosen.
  // Handled in the event, not an effect: creating a URL is a side effect and
  // has no business running during render.
  useEffect(() => () => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
  }, []);

  const choose = (next: File | null) => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    const url = next ? URL.createObjectURL(next) : null;
    previewRef.current = url;
    setFile(next);
    setPreview(url);
  };

  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const chosen = e.target.files?.[0];
    if (!chosen) return;
    setError(null);
    if (!ACCEPTED_IMAGE_TYPES.includes(chosen.type as (typeof ACCEPTED_IMAGE_TYPES)[number])) {
      setError(t("errFileType"));
      return;
    }
    if (chosen.size > MAX_RECEIPT_BYTES) {
      setError(t("errFileSize"));
      return;
    }
    choose(chosen);
  };

  // crypto.randomUUID only exists in secure contexts. The real-phone pass
  // runs over plain http on the LAN, where it is undefined and the throw
  // surfaced as a fake "check your connection". getRandomValues exists
  // everywhere; RFC 4122 v4 by hand is four lines.
  const uuid = (): string => {
    if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
    const b = crypto.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  };

  const submit = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);

    try {
      const supabase = supabaseBrowser();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        setError(t("errNotSignedIn"));
        setBusy(false);
        return;
      }

      // `<campaign>/<auth-uid>/<uuid>.<ext>` — the storage policy checks the
      // second segment against auth.uid(), so this is the only shape that can
      // be written by this account.
      const ext = EXTENSION[file.type] ?? "jpg";
      const path = `${campaign.slug}/${auth.user.id}/${uuid()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from(RECEIPTS_BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false });

      if (uploadError) {
        console.error("[tickets upload] storage upload failed", uploadError);
        setError(t("errGeneric"));
        setBusy(false);
        return;
      }

      const res = await fetch(`/api/tickets/${campaign.slug}/receipts/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imagePath: path, contentType: file.type }),
      });

      if (!res.ok) {
        // The object stays in the private bucket if this fails mid-flight. That
        // is deliberate: participants have no delete policy, because a receipt
        // under review must not be removable by the person who submitted it.
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        const key = API_ERROR_KEYS[payload.error as keyof typeof API_ERROR_KEYS];
        setError(t(key ?? "errGeneric"));
        setBusy(false);
        return;
      }

      choose(null);
      await reload();
    } catch {
      setError(t("errNetwork"));
    } finally {
      setBusy(false);
    }
  };

  if (status === "loading" || status === "anon" || status === "no-profile") {
    return <div className="tk-pad"><p className="tk-body">{t("loading")}</p></div>;
  }

  const claim = currentClaim(me);
  const openReceipt =
    claim && (claim.receipt.status === "received" || claim.receipt.status === "in_review")
      ? claim.receipt
      : null;

  // Since points (v2) there is no "already claimed" wall here: the welcome
  // reward is once-ever, but every further approved receipt earns points, so
  // an already-rewarded participant uploading again is the retention loop
  // working — not a mistake to block.

  // ---- receipt in flight --------------------------------------------------
  if (openReceipt) {
    return (
      <div className="tk-pad">
        {/* First child in every branch, so React keeps it mounted across the
            in-flight → approved re-render — the exact moment it exists for. */}
        <ApprovalCelebration me={me} />
        <div>
          <div className="tk-eyebrow">{t("regStep", { n: 3 })}</div>
          <h1 className="tk-h" style={{ fontSize: 26, marginTop: 6 }}>{t("prcTitle")}</h1>
          <p className="tk-body" style={{ fontSize: 13.5, marginTop: 6 }}>
            {t("prcSub", { hours: campaign.reviewSlaHours })}
          </p>
        </div>
        <div className="tk-card">
          <StatusTimeline status={openReceipt.status} />
        </div>
        <Link href={`${base}panel/`} className="tk-btn ghost sm">
          {t("navPanel")} →
        </Link>
      </div>
    );
  }

  // ---- capture ------------------------------------------------------------
  const needsRetry = claim?.receipt.status === "needs_new_image";

  return (
    <div className="tk-pad">
      <ApprovalCelebration me={me} />
      <div>
        <div className="tk-eyebrow">{t("regStep", { n: 3 })}</div>
        <h1 className="tk-h" style={{ fontSize: 28, marginTop: 6 }}>{t("capTitle")}</h1>
        <p className="tk-body" style={{ fontSize: 13.5, marginTop: 6 }}>{t("capSub")}</p>
      </div>

      {needsRetry && (
        <div className="tk-card yellow">
          <p style={{ fontSize: 13.5, lineHeight: 1.45, fontWeight: 600 }}>
            {t("pnNeedsNewImage")}
          </p>
          {claim?.receipt.reject_reason && (
            <p className="tk-foot" style={{ marginTop: 8, color: "var(--tk-ink)" }}>
              {t("pnRejected", { reason: claim.receipt.reject_reason })}
            </p>
          )}
        </div>
      )}

      {!canSubmit && <p className="tk-error">{t("errClosed")}</p>}
      {error && <p className="tk-error">{error}</p>}

      <div className="tk-camera">
        <span className="tk-corner tl" />
        <span className="tk-corner tr" />
        <span className="tk-corner bl" />
        <span className="tk-corner br" />
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- blob: URL, nothing for next/image to optimise
          <img src={preview} alt={t("capPreviewAlt")} />
        ) : (
          <div className="tk-guide" />
        )}
        <div className="tk-hint">{preview ? (file?.name ?? "") : t("capEmpty")}</div>
      </div>

      <div className="tk-card flat tk-checklist">
        {[t("capQ1"), t("capQ2"), t("capQ3")].map((line) => (
          <div className="item" key={line}>
            <span className="dot">✓</span>
            {line}
          </div>
        ))}
      </div>

      <input
        ref={fileInput}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(",")}
        capture="environment"
        hidden
        onChange={pick}
      />

      {file ? (
        <>
          <button
            className="tk-btn"
            type="button"
            onClick={submit}
            disabled={busy || !canSubmit}
          >
            {busy ? t("capSending") : t("capSend")} →
          </button>
          <button
            className="tk-btn ghost sm"
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={busy}
          >
            {t("capChange")}
          </button>
        </>
      ) : (
        <button
          className="tk-btn"
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={!canSubmit}
        >
          📸 {t("capPick")}
        </button>
      )}

      <p className="tk-foot" style={{ textAlign: "center" }}>{t("capNote")}</p>
      <p className="tk-foot">
        {t("heroSub", {
          min: money(campaign.minPurchaseCents),
          reward: money(campaign.rewardCents),
        })}
      </p>
    </div>
  );
}

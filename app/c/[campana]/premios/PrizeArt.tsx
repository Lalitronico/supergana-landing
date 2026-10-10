"use client";

import { useState } from "react";
import { prizeDetail, prizeName, type StorePrize } from "@/lib/tickets/store";
import { useTickets } from "../TicketsShell";
import { PrizeIcon } from "./PrizeIcon";

/**
 * The picture of a prize, with three levels of "we have art":
 *
 *   1. `detail.image_url` — the real illustration, validated by `asAssetUrl`
 *      inside `prizeDetail`. If the file 404s (art not deployed yet, a typo in
 *      the data) the `onError` drops to level 2 instead of showing a broken
 *      image — the demo must never wear a missing-file icon.
 *   2. A gift card drawn in CSS from the prize's own face value, for
 *      `kind === "giftcard"`. It reads as the object it is, in the tenant's
 *      brand colour, with nothing tenant-specific in the code.
 *   3. The line icon for the kind (`PrizeIcon`), as before.
 *
 * Decorative: the prize's name is always printed beside it.
 */
export function PrizeArt({
  prize,
  wide = false,
}: {
  prize: Pick<StorePrize, "kind" | "detail" | "nameEs" | "nameEn">;
  /** The featured prize gets a wider frame. */
  wide?: boolean;
}) {
  const { locale, money } = useTickets();
  const { imageUrl, valueCents } = prizeDetail(prize, locale);
  // Remember WHICH url failed, not that "something" failed: if the data later
  // points the prize at a different file, it gets its own chance.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showImage = imageUrl !== null && failedUrl !== imageUrl;

  return (
    <div className={["jr-art", wide ? "wide" : null].filter(Boolean).join(" ")} aria-hidden="true">
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- tenant art from data; next/image would need every host allow-listed
        <img
          src={imageUrl}
          alt=""
          decoding="async"
          onError={() => setFailedUrl(imageUrl)}
          // The server renders this <img> and the browser may have already
          // failed to load it before React hydrates, in which case `onError`
          // never fires. A finished load with no pixels is the same failure,
          // caught here after the fact.
          ref={(el) => {
            if (el && el.complete && el.naturalWidth === 0) setFailedUrl(imageUrl);
          }}
        />
      ) : prize.kind === "giftcard" ? (
        <GiftFace value={valueCents !== null ? money(valueCents) : null} name={prizeName(prize, locale)} />
      ) : (
        <PrizeIcon kind={prize.kind} className="big" />
      )}
    </div>
  );
}

/** A gift card seen from the front. Brand colour, chip, face value. */
function GiftFace({ value, name }: { value: string | null; name: string }) {
  const { t } = useTickets();
  return (
    <div className="jr-giftface">
      <span className="jr-giftface-chip" />
      <span className="jr-giftface-label">{t("jrGiftCard")}</span>
      <b className="jr-giftface-value">{value ?? name}</b>
      <span className="jr-giftface-shine" />
    </div>
  );
}

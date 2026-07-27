"use client";

import Link from "next/link";
import { useTickets } from "./TicketsShell";

interface QuotaView {
  weeklyQuota: number;
  weeklyLeft: number;
  totalLeft: number;
}

interface ProductView {
  brand: string;
  name: string;
  size: string | null;
}

/** Wraps the keyword in a highlighter without hardcoding word order per language. */
function Headline({ text, mark }: { text: string; mark: string }) {
  const at = text.indexOf(mark);
  if (at === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <span className="tk-mark">{mark}</span>
      {text.slice(at + mark.length)}
    </>
  );
}

export function HomeScreen({
  quota,
  products,
}: {
  quota: QuotaView;
  products: ProductView[];
}) {
  const { campaign, t, base, money } = useTickets();
  const min = money(campaign.minPurchaseCents);
  const reward = money(campaign.rewardCents);

  const soldOut = quota.weeklyLeft === 0 || quota.totalLeft === 0;
  const pct =
    quota.weeklyQuota > 0
      ? Math.round((quota.weeklyLeft / quota.weeklyQuota) * 100)
      : 0;

  // Brand chips come from campaign config (illustrative, as the demo labels
  // them). If a campaign has none configured, fall back to the real validation
  // catalogue rather than showing an empty card.
  const brands =
    campaign.brands.length > 0
      ? campaign.brands
      : [...new Set(products.map((p) => p.brand))].map((name) => ({
          name,
          color: "#0A0A0A",
        }));

  return (
    <div className="tk-pad">
      <div>
        <div className="tk-eyebrow">{t("heroEyebrow", { org: campaign.orgName })}</div>
        <h1 className="tk-h" style={{ fontSize: 34, marginTop: 6 }}>
          <Headline text={t("heroTitle")} mark={t("heroTitleMark")} />
        </h1>
      </div>
      <p className="tk-body">{t("heroSub", { min, reward })}</p>

      <div className="tk-ticket">
        <div className="top">
          <div className="tk-eyebrow">
            {soldOut ? t("quotaEmpty") : t("quotaLabel")}
          </div>
          {!soldOut && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
              <div className="tk-quota-track">
                <div className="tk-quota-fill" style={{ width: `${pct}%` }} />
              </div>
              <b style={{ fontFamily: "var(--tk-display)", fontSize: 13, whiteSpace: "nowrap" }}>
                {t("quotaLeft", { left: quota.weeklyLeft, total: quota.weeklyQuota })}
              </b>
            </div>
          )}
          <p className="tk-foot" style={{ marginTop: 8 }}>
            {soldOut ? t("quotaEmptyNote") : t("quotaNote")}
          </p>
        </div>
        <div className="rip" />
        <div className="bottom">
          <Link href={`${base}subir/`} className="tk-btn ink">
            {t("heroCta")} →
          </Link>
        </div>
      </div>

      <div className="tk-card">
        <h2 className="tk-h" style={{ fontSize: 19, marginBottom: 12 }}>
          {t("howTitle")}
        </h2>
        <div className="tk-steps">
          {(
            [
              [t("how1Lead", { min }), t("how1Rest")],
              [t("how2Lead"), t("how2Rest")],
              [t("how3Lead", { reward }), t("how3Rest")],
            ] as const
          ).map(([lead, rest], i) => (
            <div className="tk-step" key={lead}>
              <span className="n">{i + 1}</span>
              <p>
                <b>{lead}</b> {rest}
              </p>
            </div>
          ))}
        </div>
      </div>

      {brands.length > 0 && (
        <div className="tk-card">
          <h2 className="tk-h" style={{ fontSize: 19, marginBottom: 10 }}>
            {t("brandsTitle")}
          </h2>
          <div className="tk-brands">
            {brands.map((brand) => (
              <span className="tk-chip" key={brand.name}>
                <span className="swatch" style={{ background: brand.color }} />
                {brand.name}
              </span>
            ))}
          </div>
          <p className="tk-foot" style={{ marginTop: 10 }}>
            {t("brandsNote", { org: campaign.orgName })}
          </p>
        </div>
      )}

      {campaign.eligibleStates.length > 0 && (
        <div className="tk-card flat">
          <h2 className="tk-h" style={{ fontSize: 16, marginBottom: 6 }}>
            {t("statesTitle")}
          </h2>
          <p className="tk-foot">
            {t("statesNote", { states: campaign.eligibleStates.join(", ") })}
          </p>
        </div>
      )}

      <p className="tk-foot">
        {t("legalHome")}
        {campaign.rulesUrl && (
          <>
            {" "}
            <a href={campaign.rulesUrl} style={{ color: "inherit" }}>
              {t("rulesLink")}
            </a>
            .
          </>
        )}
      </p>
      <p className="tk-foot">{t("poweredBy")}</p>
    </div>
  );
}

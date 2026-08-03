"use client";

import Link from "next/link";
import { useTickets } from "./TicketsShell";
import { useMe } from "./useMe";

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

/**
 * The home is the QR landing page, so it must offer a door to people who
 * already have an account — before this, /entrar/ was only reachable by
 * being bounced off a gate. Session state decides which door to show.
 */
function AccountDoors() {
  const { campaign, t, base } = useTickets();
  const { status } = useMe(campaign.slug);

  return (
    <>
      {/* Nothing while the session resolves: a "sign in" that morphs into
          "my panel" reads as a glitch on a phone. */}
      {status === "anon" && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
          <span className="tk-foot" style={{ fontWeight: 700 }}>{t("homeAccountQ")}</span>
          <Link href={`${base}entrar/?next=panel`} className="tk-linkbtn">
            {t("homeSignIn")}
          </Link>
          <Link href={`${base}crear-cuenta/`} className="tk-linkbtn">
            {t("homeCreate")}
          </Link>
        </div>
      )}
      {(status === "ready" || status === "no-profile") && (
        <Link
          href={`${base}panel/`}
          className="tk-linkbtn"
          style={{ textAlign: "center" }}
        >
          {t("homeGoPanel")} →
        </Link>
      )}
    </>
  );
}

/**
 * Threshold campaigns (Ticket al Tanque): buy {min} in one transaction, get
 * {reward} back. The reward is rationed, so the stock is the headline.
 */
function ThresholdHome({
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

      <AccountDoors />

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

/**
 * Accumulation campaigns (Carrera Alaska): every eligible peso earns points and
 * no receipt pays a reward. Nothing here may mention a minimum purchase, a
 * reward amount, a weekly quota or a sold-out state — none of those exist in
 * this mechanic, and printing them from a zeroed config is what made this
 * screen announce "buy $0, get $0, all gone".
 */
function AccumulationHome({ products }: { products: ProductView[] }) {
  const { campaign, t, base } = useTickets();
  const rate = campaign.pointsPerDollar;
  const org = campaign.orgName;

  // The real validation catalogue, which is what a shopper needs in front of
  // the shelf. Falls back to the configured brand chips for a multi-brand
  // accumulation campaign that has no products seeded yet.
  const items =
    products.length > 0
      ? products.map((p) => ({ key: `${p.brand} ${p.name}`, label: p.name }))
      : campaign.brands.map((b) => ({ key: b.name, label: b.name }));

  return (
    <div className="tk-pad">
      <div>
        <div className="tk-eyebrow">{t("heroEyebrow", { org })}</div>
        <h1 className="tk-h" style={{ fontSize: 34, marginTop: 6 }}>
          <Headline text={t("accHeroTitle")} mark={t("accHeroTitleMark")} />
        </h1>
      </div>
      <p className="tk-body">{t("accHeroSub", { org, rate })}</p>

      <div className="tk-ticket">
        <div className="top">
          <div className="tk-eyebrow">{t("accRateLabel")}</div>
          <div className="tk-amount" style={{ fontSize: 34, marginTop: 4 }}>
            {t("accRateLine", { rate })}
          </div>
          <p className="tk-foot" style={{ marginTop: 8 }}>{t("accRateNote")}</p>
        </div>
        <div className="rip" />
        <div className="bottom">
          <Link href={`${base}subir/`} className="tk-btn ink">
            {t("heroCta")} →
          </Link>
        </div>
      </div>

      <AccountDoors />

      <div className="tk-card">
        <h2 className="tk-h" style={{ fontSize: 19, marginBottom: 12 }}>
          {t("accHowTitle")}
        </h2>
        <div className="tk-steps">
          {(
            [
              [t("acc1Lead", { org }), t("acc1Rest")],
              [t("acc2Lead"), t("acc2Rest")],
              [t("acc3Lead", { rate }), t("acc3Rest")],
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

      {items.length > 0 && (
        <div className="tk-card">
          <h2 className="tk-h" style={{ fontSize: 19, marginBottom: 10 }}>
            {t("accProductsTitle")}
          </h2>
          <div className="tk-brands">
            {items.map((item) => (
              <span className="tk-chip" key={item.key}>
                {item.label}
              </span>
            ))}
          </div>
          <p className="tk-foot" style={{ marginTop: 10 }}>
            {t("accProductsNote", { org })}
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
        {t("accLegalHome")}
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

export function HomeScreen({
  quota,
  products,
}: {
  quota: QuotaView;
  products: ProductView[];
}) {
  const { campaign } = useTickets();
  return campaign.mechanic === "accumulation" ? (
    <AccumulationHome products={products} />
  ) : (
    <ThresholdHome quota={quota} products={products} />
  );
}

"use client";

import Link from "next/link";
import { useSession, useTickets } from "./TicketsShell";
import { Confetti } from "./Confetti";
import { Headline } from "./Headline";
import { Mascot } from "./Mascot";
import { NextPrizeProgress } from "./NextPrizeProgress";
import { StepStrip } from "./StepStrip";

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

/**
 * The upload call to action, as the bottom half of the ticket.
 *
 * A camera on a ticket stub, not a button that says "upload": the whole
 * mechanic is "photograph the paper in your hand", and the mockups are right
 * that this is the one element on the home that should look pressable from
 * across the room. It stays inside the ticket rather than becoming a second
 * yellow slab, so the rate above it and the action below it read as one object.
 */
function CtaLine({ href, title, sub }: { href: string; title: string; sub: string }) {
  return (
    <Link href={href} className="tk-ctaline">
      <span className="tk-ctaline-ico" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3.4 8.6c0-1 .8-1.8 1.8-1.8h2.3l1.3-2h6.4l1.3 2h2.3c1 0 1.8.8 1.8 1.8v8.6c0 1-.8 1.8-1.8 1.8H5.2c-1 0-1.8-.8-1.8-1.8Z" />
          <circle cx="12" cy="13" r="3.4" />
        </svg>
      </span>
      <span className="tk-ctaline-text">
        <b>{title}</b>
        <span>{sub}</span>
      </span>
      {/* An SVG chevron, not "›": Bricolage draws that glyph as a comma-sized
          tick at any weight, which reads as a rendering fault on the one
          element of this screen that has to look pressable. */}
      <span className="tk-ctaline-go" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m9 5 7 7-7 7" />
        </svg>
      </span>
    </Link>
  );
}

/**
 * The home is the QR landing page, so it must offer a door to people who
 * already have an account — before this, /entrar/ was only reachable by
 * being bounced off a gate. Session state decides which door to show.
 */
function AccountDoors() {
  const { t, base } = useTickets();
  const { status } = useSession();

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

  // The hero art is the mascot's, and the confetti belongs to it: a tenant with
  // no artwork gets a full-width headline, which is exactly the layout this
  // screen shipped with. No tenant needs an illustrator to launch.
  const hasArt = Boolean(campaign.theme.mascots.greet);

  return (
    <div className="tk-pad">
      {/* No eyebrow here, unlike the threshold home: this headline already says
          the org's name, in the org's colour, and saying it twice in the two
          biggest type sizes on the screen reads as a stutter. */}
      <div className={hasArt ? "tk-hero art" : "tk-hero"}>
        <h1 className="tk-h tk-hero-title">
          <Headline text={t("accHeroTitle", { org })} mark={org} as="brand" />
        </h1>
        {hasArt && (
          <div className="tk-hero-art">
            <Confetti />
            <Mascot pose="greet" />
          </div>
        )}
      </div>
      <p className="tk-body">{t("accHeroSub")}</p>

      <StepStrip />

      <div className="tk-ticket">
        <div className="top">
          <div className="tk-eyebrow">{t("accRateLabel")}</div>
          <div className="tk-amount" style={{ fontSize: 34, marginTop: 4 }}>
            {t("accRateLine", { rate })}
          </div>
          <p className="tk-foot" style={{ marginTop: 8 }}>{t("accRateNote")}</p>
        </div>
        <div className="rip" />
        <div className="bottom pressable">
          <CtaLine
            href={`${base}subir/`}
            title={t("ctaUploadTitle")}
            sub={t("ctaUploadSub")}
          />
        </div>
      </div>

      {/* Renders nothing until there is a session and an open Drop. For a
          participant it is the reason to press the ticket above. */}
      <NextPrizeProgress />

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

"use client";

import Link from "next/link";
import { useSession, useTickets } from "./TicketsShell";
import { Confetti } from "./Confetti";
import { Headline } from "./Headline";
import { Mascot } from "./Mascot";
import { NextPrizeProgress } from "./NextPrizeProgress";
import { StepStrip } from "./StepStrip";
import { brandNames } from "./showcase/brandNames";
import { BrandLockup } from "./showcase/BrandLockup";
import { PrizeTeaser, type TeaserPrize } from "./showcase/PrizeTeaser";
import { ProductGallery } from "./showcase/ProductGallery";

interface QuotaView {
  weeklyQuota: number;
  weeklyLeft: number;
  totalLeft: number;
}

interface ProductView {
  brand: string;
  name: string;
  size: string | null;
  /** Validated asset URL, or null. Only the accumulation home draws it. */
  imageUrl: string | null;
}

/** Staggered entrance: block `n` of the screen rises `n * 70ms` after the first. */
const rise = (n: number) => ({ "--i": n }) as React.CSSProperties;

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
  const { campaign, t, base } = useTickets();
  const { status } = useSession();

  return (
    <>
      {/* Nothing while the session resolves: a "sign in" that morphs into
          "my panel" reads as a glitch on a phone. */}
      {status === "anon" && (
        <div className="sh-doors" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
          <span className="tk-foot" style={{ fontWeight: 700 }}>{t("homeAccountQ")}</span>
          <Link href={`${base}entrar/?next=panel`} className="tk-linkbtn">
            {t("homeSignIn")}
          </Link>
          {/* A campaign identified by phone has ONE door and it is the same
              one either way: proving the number signs you in if you have an
              account and creates one if you do not. Offering "create an
              account" beside "sign in" would ask people to know which of the
              two they are — and the sign-in route deliberately refuses to tell
              them. */}
          {campaign.authChannel !== "phone" && (
            <Link href={`${base}crear-cuenta/`} className="tk-linkbtn">
              {t("homeCreate")}
            </Link>
          )}
        </div>
      )}
      {(status === "ready" || status === "no-profile") && (
        <Link
          href={`${base}panel/`}
          className="tk-linkbtn"
          style={{ textAlign: "center" }}
        >
          {t("homeGoPanel")}&nbsp;→
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
            {t("heroCta")}&nbsp;→
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
function AccumulationHome({
  products,
  prizes,
}: {
  products: ProductView[];
  prizes: TeaserPrize[];
}) {
  const { campaign, t, base, locale } = useTickets();
  const rate = campaign.pointsPerDollar;
  const org = campaign.orgName;
  // What counts for points. When the campaign names its brands, ONLY those do
  // ("Jarritos y Mineragua", not every product of the parent company), so the
  // copy that says "products of X" must say X = the brands. No brands: the org.
  const eligible = brandNames(campaign.brands, locale) ?? org;

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

  // The photo gallery is opt-in by data: it needs at least one product image.
  // Without any, the chips above stay exactly as every earlier campaign had them.
  const galleryProducts = products.some((p) => p.imageUrl) ? products : [];

  return (
    <div className="tk-pad">
      {/* No eyebrow here, unlike the threshold home: this headline already says
          the org's name, in the org's colour, and saying it twice in the two
          biggest type sizes on the screen reads as a stutter. */}
      <div className={hasArt ? "tk-hero art sh-rise" : "tk-hero sh-rise"} style={rise(0)}>
        <h1 className="tk-h tk-hero-title">
          <Headline text={t("accHeroTitle", { org })} mark={t("accHeroMark", { org })} as="brand" />
        </h1>
        {hasArt && (
          <div className="tk-hero-art">
            <Confetti />
            <Mascot pose="greet" />
          </div>
        )}
      </div>
      <p className="tk-body sh-rise" style={rise(1)}>
        {t("accHeroSub")}
      </p>

      <div className="sh-rise" style={rise(2)}>
        <BrandLockup brands={campaign.brands} />
      </div>

      {/* The ticket comes before the glance strip: the one thing this screen
          exists for is the press, and on a 390x844 phone it has to be on the
          first screen with its camera icon, not scrolled to. */}
      <div className="tk-ticket sh-ticket sh-rise" style={rise(3)}>
        <div className="top">
          <div className="tk-eyebrow">{t("accRateLabel")}</div>
          <div className="tk-amount sh-rate" style={{ fontSize: 34, marginTop: 4 }}>
            {t("accRateLine", { rate })}
          </div>
          <p className="tk-foot" style={{ marginTop: 8 }}>{t("accRateNote")}</p>
          {/* Decorative stamp: the star is the system's mark for points. */}
          <span className="sh-stamp" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path
                d="m12 2.6 2.9 6.05 6.6.86-4.85 4.55 1.24 6.54L12 17.4l-5.89 3.2 1.24-6.54L2.5 9.51l6.6-.86z"
                fill="var(--tk-ink)"
              />
            </svg>
          </span>
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

      <div className="sh-rise" style={rise(4)}>
        <StepStrip />
      </div>

      {/* Renders nothing until there is a session and an open Drop. For a
          participant it is the reason to press the ticket above. */}
      <NextPrizeProgress />

      <AccountDoors />

      <PrizeTeaser prizes={prizes} />

      {galleryProducts.length > 0 ? (
        <section className="sh-gallery-block">
          <h2 className="tk-h" style={{ fontSize: 19 }}>
            {t("accProductsTitle")}
          </h2>
          <ProductGallery products={galleryProducts} brands={campaign.brands} />
          <p className="tk-foot">{t("accProductsNote", { org: eligible })}</p>
        </section>
      ) : (
        items.length > 0 && (
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
              {t("accProductsNote", { org: eligible })}
            </p>
          </div>
        )
      )}

      {/* Replaces the "how it works" card: the strip above already says buy,
          upload, earn, redeem, and repeating it as three paragraphs made the
          page say the same thing twice. These answer what the strip cannot. */}
      <section className="sh-faq">
        <h2 className="tk-h" style={{ fontSize: 19 }}>
          {t("shFaqTitle")}
        </h2>
        {(
          [
            ["shFaqEarnQ", "shFaqEarnA"],
            ["shFaqWhenQ", "shFaqWhenA"],
            ["shFaqRedeemQ", "shFaqRedeemA"],
          ] as const
        ).map(([q, a]) => (
          <details key={q}>
            <summary>{t(q)}</summary>
            <p>{t(a, { rate })}</p>
          </details>
        ))}
      </section>

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
  prizes,
}: {
  quota: QuotaView;
  products: ProductView[];
  prizes: TeaserPrize[];
}) {
  const { campaign } = useTickets();
  return campaign.mechanic === "accumulation" ? (
    <AccumulationHome products={products} prizes={prizes} />
  ) : (
    <ThresholdHome quota={quota} products={products} />
  );
}

// Campaign configuration for the Mundial 2026 x Rotary donation quiniela.
// All times are UTC. Kickoffs verified 2026-07-07 against published schedule:
// QF1 Boston Jul 9 16:00 ET, semis Jul 14/15 15:00 ET, final Jul 19 15:00 ET.

export const CAMPAIGN = {
  name: "Quiniela Mundial x Rotary",
  slug: "mundial-rotary",
  ticketPriceUsd: 100,
  donationShare: 0.75,
  prizeShares: {
    cuartos: 0.07,
    semis: 0.08,
    final: 0.1,
  },
  // Rolling participation: you can join after cuartos kicked off, but you
  // only compete in stages whose lock had not passed when you submitted.
  stageLocks: {
    cuartos: "2026-07-09T20:00:00Z",
    semis: "2026-07-14T19:00:00Z",
    final: "2026-07-19T19:00:00Z",
  },
  goalMinTickets: 100,
  goalIdealTickets: 150,
} as const;

export type Stage = keyof typeof CAMPAIGN.stageLocks;

export const STAGES: Stage[] = ["cuartos", "semis", "final"];

export const STAGE_LABELS: Record<Stage, string> = {
  cuartos: "Cuartos de final",
  semis: "Semifinales",
  final: "La final",
};

// The key match whose exact score is the tiebreaker for each stage's prize
// (concrete labels/teams live in the form's TB_MATCH). Cuartos is compared
// ordered (teams known); semis/final unordered (teams TBD at fill time).

// Live Payment Link created by the user on 2026-07-07. The env var can
// override it (e.g. to point at a test-mode link in previews).
export const STRIPE_PAYMENT_LINK =
  process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK ??
  "https://buy.stripe.com/aFa8wQffiekEftT6qRds400";

// The Stripe account (CBBI LLC) is shared with other products, so a
// checkout.session.completed webhook fires for THEIR payments too. Only
// sessions created from THIS Payment Link should ever mint a quiniela ticket.
// Override via env if the link is ever recreated.
export const STRIPE_PAYMENT_LINK_ID =
  process.env.STRIPE_PAYMENT_LINK_ID ?? "plink_1Tqh5OK6mZgJgsly7G3ClKG2";

export const isOurPaymentLink = (paymentLinkId: string | null | undefined) =>
  paymentLinkId === STRIPE_PAYMENT_LINK_ID;

export const stageLockDate = (stage: Stage) =>
  new Date(CAMPAIGN.stageLocks[stage]);

export const isStageLocked = (stage: Stage, at: Date = new Date()) =>
  at.getTime() >= stageLockDate(stage).getTime();

/** Stages an entry submitted at `submittedAt` still competes in. */
export const eligibleStages = (submittedAt: Date): Stage[] =>
  STAGES.filter((stage) => submittedAt.getTime() < stageLockDate(stage).getTime());

export interface PrizePool {
  ticketsSold: number;
  totalUsd: number;
  donationUsd: number;
  prizesTotalUsd: number;
  prizeByStage: Record<Stage, number>;
}

export const computePrizePool = (ticketsSold: number, totalUsd?: number): PrizePool => {
  const total = totalUsd ?? ticketsSold * CAMPAIGN.ticketPriceUsd;
  return {
    ticketsSold,
    totalUsd: total,
    donationUsd: round2(total * CAMPAIGN.donationShare),
    prizesTotalUsd: round2(
      total *
        (CAMPAIGN.prizeShares.cuartos +
          CAMPAIGN.prizeShares.semis +
          CAMPAIGN.prizeShares.final),
    ),
    prizeByStage: {
      cuartos: round2(total * CAMPAIGN.prizeShares.cuartos),
      semis: round2(total * CAMPAIGN.prizeShares.semis),
      final: round2(total * CAMPAIGN.prizeShares.final),
    },
  };
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export const formatUsd = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);

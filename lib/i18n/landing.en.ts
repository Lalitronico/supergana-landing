import type { LandingCopy } from "./landing.es";

/**
 * English copy for the platform landing.
 *
 * Written for the US pitch (Novamex, Chapa), not translated literally — the
 * module names in particular are localised rather than transliterated:
 * "quiniela" means nothing to an English speaker, so it ships as "Prediction
 * Pools". The one exception is the PROFECO line in `operamosTodo`, which names
 * a Mexican regulator by design; the English version names the US equivalent
 * shape (official rules, AMOE) because the claim is that we handle whichever
 * regime applies.
 *
 * The `LandingCopy` annotation is the safety net: a missing or misspelled key
 * is a build error, not a Spanish sentence on an English page.
 */
export const en: LandingCopy = {
  meta: {
    htmlLang: "en-US",
    ogLocale: "en_US",
    title: "Supergana — Your brand, made playable",
    description:
      "White-label gamified experiences for marketing, HR and loyalty: prediction pools, receipt races and points stores in your own identity, with real rewards in 200+ countries. We build it and we run it.",
    keywords: [
      "gamified experiences",
      "gamification for brands",
      "white label engagement platform",
      "brand activation",
      "loyalty program",
      "prediction pools for companies",
      "employee engagement HR",
      "global rewards fulfillment",
    ],
  },

  nav: {
    links: [
      { href: "#modulos", label: "Modules" },
      { href: "#como-funciona", label: "How it works" },
      { href: "#video", label: "Video" },
      { href: "#casos", label: "Cases" },
    ],
    cta: "Book a demo",
    languageLabel: "Site language",
  },

  hero: {
    pill: "Gamified experiences for brands",
    titleLead: "Your brand,",
    titleMark: "made playable.",
    body: "Supergana turns your marketing, HR and loyalty campaigns into gamified experiences carrying your identity — with real rewards in over 200 countries. Live in days, not months.",
    cta: "Book a demo",
    secondary: "See the modules ↓",
    micro: "No licences, no learning curve: we run it for you.",
    bubble: "Let's play!",
    mock: {
      header: "CAMPAIGN · YOUR BRAND",
      live: "● LIVE",
      badge: "CHALLENGE 3 · WEEK 2",
      question: "Who wins Friday's derby?",
      optionHome: "Home",
      optionAway: "Away",
      cta: "Submit prediction",
    },
  },

  marquee: {
    verticals: [
      "MARKETING",
      "HUMAN RESOURCES",
      "LOYALTY",
      "ACTIVATIONS",
      "COMMUNITIES",
      "AGENCIES",
    ],
    operamos: [
      "DESIGN AND SETUP",
      "FULL OPERATION",
      "PRIZES AND DELIVERY",
      "RULES AND COMPLIANCE",
      "SUPPORT",
    ],
  },

  comoFunciona: {
    pill: "The process",
    titleLead: "From brief to live campaign",
    titleMark: "in days",
    steps: [
      {
        title: "Pick your format",
        body: "Prediction pool, receipt race, points store — or tell us your idea.",
        badge: "DAY 1",
      },
      {
        title: "We dress it in your brand",
        body: "Your colors, your logo, your tone. The experience feels 100% yours.",
        badge: "DAYS 2–4",
      },
      {
        title: "Your people play and win",
        body: "They join from any device and prizes arrive on their own. You watch the results in your dashboard.",
        badge: "LIVE!",
      },
    ],
  },

  modulos: {
    pill: "The catalog",
    titleLead: "One module for every",
    titleMark: "goal",
    intro:
      "Proven formats packaged as solutions: pick one, we dress it in your brand and it's ready to play.",
    outroLead: "Have a format in mind that isn't here?",
    outroLink: "We'll design it with you.",
    idealLabel: "Ideal for",
    seeModule: "See module →",
    carousel: {
      region: "Module catalog",
      roleDescription: "carousel",
      prev: "Previous module",
      next: "Next module",
      goToSlide: "See {title}",
    },
    items: [
      {
        eyebrow: "Proven in production",
        title: "Prediction Pools",
        body: "Sports predictions that hook your team or community: World Cup, leagues, internal tournaments. Recurring participation week after week.",
        idealPara: "HR · communities · associations",
      },
      {
        eyebrow: "The sweepstakes, evolved",
        title: "Receipt Race",
        body: "Turn purchases into play: your shoppers upload their receipt, collect points and compete. Your retail promo like you've never seen it.",
        idealPara: "consumer brands · retail",
      },
      {
        eyebrow: "Loyalty people actually use",
        title: "Points Store",
        body: "Points become real rewards: gift cards, experiences, cash. Loyalty your people actually want to spend.",
        idealPara: "loyalty programs · internal incentives",
      },
    ],
    mocks: {
      quiniela: {
        tournament: "WORLD CUP 2026",
        matchday: "GROUP A · MD3",
        score: "1 – 1 · 67'",
        question: "Will there be a penalty in this match?",
        optionYes: "Yes, for sure",
        optionNo: "No",
        scoreLabel: "YOUR SCORE",
        rankLabel: "RANK",
      },
      tickets: {
        header: "RACE · YOUR BRAND",
        countdown: "ENDS IN 12 DAYS",
        upload: "📸 Upload your receipt",
        uploadHint: "Every purchase adds points",
        you: "🥉 YOU",
        youScore: "2,190 pts · 21 to go!",
      },
      tienda: {
        header: "STORE · YOUR BRAND",
        items: ["$500 gift card", "Movies for 2", "Cash payout", "Experience"],
        cta: "Redeem now",
      },
    },
  },

  premios: {
    titleLead: "Here you win",
    titleMark: "for real",
    body: "Gift cards from thousands of brands, prepaid cards, cash transfers and donations — deliverable in over 200 countries, straight to the winner. Every participant redeems in their own country, in their own currency, without you lifting a finger.",
    chips: [
      "🎯 Payout just for playing",
      "🌎 Their country, their currency",
      "⚡ Automatic delivery",
    ],
    badge: "200+ countries · their currency",
    cascade: {
      giftCard: "GIFT CARD",
      cash: "CASH",
      experience: "EXPERIENCE",
      prepaid: "PREPAID",
      donation: "DONATION",
      brandLogoSlot: "[ BRAND LOGO ]",
      transferLabel: "BANK TRANSFER",
      causeSlot: "[ CAUSE ]",
    },
    phone: {
      header: "YOUR BRAND · REWARDS",
      points: "1,250 pts",
      payoutTitle: "🎉 You've got a payout!",
      payoutSub: "For taking part. Pick how to cash it:",
      options: [
        { name: "Gift card", meta: "+2,000 BRANDS" },
        { name: "Cash payout", meta: "✓ SELECTED" },
        // "Prepaid", not "Prepaid card": the phone mock is 290px wide and the
        // longer name wrapped, leaving this row 19px taller than its three
        // neighbours in a stack that reads as a list of equals.
        { name: "Prepaid", meta: "VIRTUAL OR PHYSICAL" },
        { name: "Donation", meta: "PICK A CAUSE" },
      ],
      more: "…and many more options in their country",
      cta: "Cash out now",
    },
  },

  mundoPropio: {
    pill: "One of a kind",
    titleLead: "The only platform with",
    titleMark: "a world of its own",
    body: "Seven rubber-hose characters and a visual universe that brings every campaign to life. The competition sells generic templates; we bring personality — or hold it back so your brand shines alone. Your call.",
  },

  promo: {
    pill: "On video",
    titleLead: "Supergana in",
    titleMark: "52 seconds",
    body: "What we do, how it looks with your brand on it, and why your people come back to play. No slides.",
    frameLabel: "PROMO",
    frameLabelLong: " · SUPERGANA",
    trackLabel: "Video language",
    play: "Play the promo video in {lang}",
  },

  operamosTodo: {
    titleLead: "You bring the brand.",
    titleMark: "We bring everything else.",
    sticker: "TURNKEY",
    bullets: [
      {
        title: "Design and setup",
        body: "Your campaign live in days, carrying your identity.",
      },
      {
        title: "Full operation",
        body: "We run it end to end; you watch the dashboard.",
      },
      {
        title: "Prizes and delivery",
        body: "From catalog to winner, with no logistics on your side.",
      },
      {
        title: "Rules and compliance",
        body: "Official rules, regulator notices and a free alternative method of entry wherever it applies. Settled before launch.",
      },
    ],
  },

  casos: {
    titleLead: "It's already",
    titleMark: "happening",
    badge: "WORLD CUP 2026 · REAL CASE",
    title: "World Cup Pool × Rotary",
    body: "A 2026 World Cup prediction pool for a cause, run for the Rotary Club of Ciudad Juárez: the community predicts, competes, and what it raises turns into real impact.",
    stats: ["116 tickets", "$11,600 USD raised", "75% straight to the cause"],
    illustrationSlot: "ILLUSTRATION — CHARACTERS IN THE STADIUM",
    illustrationAlt:
      "Supergana characters celebrating in the stands of a stadium",
    yourBrandTitle: "Your brand here",
    yourBrandBody:
      "This is how yours would look. Book a demo and we'll show it to you with your logo on it.",
    cta: "Book a demo",
  },

  ctaFinal: {
    title: "Game on?",
    body: "Tell us your goal in a 30-minute call and we'll show you what your campaign would look like.",
    cta: "Book a demo",
    micro: "30-minute call · no commitment",
  },

  footer: {
    links: [
      { href: "#modulos", label: "Modules" },
      { href: "#casos", label: "Cases" },
    ],
    contact: "Contact",
    rights: "© 2026 Supergana",
  },
};

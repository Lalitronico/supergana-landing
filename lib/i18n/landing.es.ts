/**
 * Spanish copy for the platform landing — the source of truth for the
 * dictionary's *shape*. `LandingCopy` is derived from this object, so adding a
 * key here makes the English file fail to compile until it is translated. That
 * is deliberate: the failure mode this guards against is an English visitor
 * hitting a stray Spanish sentence, which no test would catch.
 *
 * Strings only. Colours, rotations, character poses and the in-product mock
 * markup stay in the components — they are the same in every language, and
 * routing them through here would make the dictionary un-serialisable across
 * the server/client boundary (`ModulosCarousel` is a client component).
 *
 * Placeholders use `{name}` and are substituted at the call site, never with a
 * function value, for the same serialisation reason.
 */
export const es = {
  meta: {
    htmlLang: "es-MX",
    ogLocale: "es_MX",
    title: "Supergana — Tu marca, hecha juego",
    description:
      "Experiencias gamificadas white-label para marketing, RH y lealtad: quinielas, carrera de tickets y tienda de puntos con tu identidad y premios reales en +200 países. Nosotros la montamos y la operamos.",
    keywords: [
      "experiencias gamificadas",
      "gamificación para marcas",
      "plataforma white label",
      "activación de marca",
      "programa de lealtad",
      "quinielas para empresas",
      "engagement recursos humanos",
      "premios multi país",
    ],
  },

  nav: {
    links: [
      { href: "#modulos", label: "Módulos" },
      { href: "#como-funciona", label: "Cómo funciona" },
      { href: "#video", label: "Video" },
      { href: "#casos", label: "Casos" },
    ],
    cta: "Agenda tu demo",
    /** Labels the ES/EN switch for screen readers. */
    languageLabel: "Idioma del sitio",
  },

  hero: {
    pill: "Experiencias gamificadas para marcas",
    titleLead: "Tu marca,",
    titleMark: "hecha juego.",
    body: "Supergana convierte tus campañas de marketing, RH y lealtad en experiencias gamificadas con tu identidad — y con premios reales en más de 200 países. Lista en días, no meses.",
    cta: "Agenda tu demo",
    secondary: "Ver los módulos ↓",
    micro: "Sin licencias, sin curva de aprendizaje: nosotros la operamos por ti.",
    bubble: "¡Juguemos!",
    mock: {
      header: "CAMPAÑA · TU MARCA",
      live: "● EN VIVO",
      badge: "RETO 3 · SEMANA 2",
      question: "¿Quién gana el clásico del viernes?",
      optionHome: "Locales",
      optionAway: "Visitantes",
      cta: "Enviar predicción",
    },
  },

  marquee: {
    verticals: [
      "MARKETING",
      "RECURSOS HUMANOS",
      "LEALTAD",
      "ACTIVACIONES",
      "COMUNIDADES",
      "AGENCIAS",
    ],
    operamos: [
      "DISEÑO Y MONTAJE",
      "OPERACIÓN COMPLETA",
      "PREMIOS Y ENTREGA",
      "REGLAS Y CUMPLIMIENTO",
      "SOPORTE",
    ],
  },

  comoFunciona: {
    pill: "El proceso",
    titleLead: "De brief a campaña viva",
    titleMark: "en días",
    steps: [
      {
        title: "Elige tu dinámica",
        body: "Quiniela, carrera de tickets, tienda de puntos — o cuéntanos tu idea.",
        badge: "DÍA 1",
      },
      {
        title: "La vestimos con tu marca",
        body: "Tus colores, tu logo, tu tono. La experiencia se siente 100% tuya.",
        badge: "DÍAS 2–4",
      },
      {
        title: "Tu gente juega y gana",
        body: "Participan desde cualquier dispositivo y los premios llegan solos. Tú ves los resultados en tu dashboard.",
        badge: "¡EN VIVO!",
      },
    ],
  },

  modulos: {
    pill: "El catálogo",
    titleLead: "Un módulo para cada",
    titleMark: "objetivo",
    intro:
      "Dinámicas empaquetadas como soluciones: elige una, la vestimos con tu marca y queda lista para jugar.",
    outroLead: "¿Tienes una dinámica en mente que no está aquí?",
    outroLink: "La diseñamos contigo.",
    idealLabel: "Ideal para",
    seeModule: "Ver módulo →",
    carousel: {
      region: "Catálogo de módulos",
      roleDescription: "carrusel",
      prev: "Módulo anterior",
      next: "Módulo siguiente",
      /** `{title}` is replaced with the slide's title. */
      goToSlide: "Ver {title}",
    },
    items: [
      {
        eyebrow: "Probado en producción",
        title: "Quinielas",
        body: "Predicciones deportivas que enganchan a tu equipo o comunidad: Mundial, ligas, torneos internos. Participación recurrente semana tras semana.",
        idealPara: "RH · comunidades · asociaciones",
      },
      {
        eyebrow: "El sweepstakes, evolucionado",
        title: "Carrera de Tickets",
        body: "Convierte compras en juego: tus consumidores suben su ticket, acumulan puntos y compiten. Tu promoción de retail como nunca la habías visto.",
        idealPara: "marcas de consumo · retail",
      },
      {
        eyebrow: "Lealtad que sí se usa",
        title: "Tienda de Puntos",
        body: "Los puntos se vuelven premios de verdad: gift cards, experiencias, cash. Lealtad que tu gente sí quiere usar.",
        idealPara: "programas de lealtad · incentivos internos",
      },
    ],
    mocks: {
      quiniela: {
        tournament: "MUNDIAL 2026",
        matchday: "GRUPO A · J3",
        score: "1 – 1 · 67'",
        question: "¿Habrá penal en el partido?",
        optionYes: "Sí, claro",
        optionNo: "No",
        scoreLabel: "TU PUNTAJE",
        rankLabel: "POSICIÓN",
      },
      tickets: {
        header: "CARRERA · TU MARCA",
        countdown: "TERMINA EN 12 DÍAS",
        upload: "📸 Sube tu ticket",
        uploadHint: "Cada compra suma puntos",
        you: "🥉 TÚ",
        youScore: "2,190 pts · ¡a 21!",
      },
      tienda: {
        header: "TIENDA · TU MARCA",
        items: ["Gift card $500", "Cine para 2", "Cash directo", "Experiencia"],
        cta: "Canjear ahora",
      },
    },
  },

  premios: {
    titleLead: "Aquí se gana",
    titleMark: "en serio",
    body: "Gift cards de miles de marcas, tarjetas prepagadas, transferencias en efectivo y donaciones — entregables en más de 200 países, directo al ganador. Cada participante canjea en su país, en su moneda, sin que tú muevas un dedo.",
    chips: [
      "🎯 Payout por participar",
      "🌎 En su país y su moneda",
      "⚡ Entrega automática",
    ],
    badge: "+200 países · su moneda",
    cascade: {
      giftCard: "GIFT CARD",
      cash: "CASH",
      experience: "EXPERIENCIA",
      prepaid: "PREPAGADA",
      donation: "DONACIÓN",
      brandLogoSlot: "[ LOGO MARCA ]",
      transferLabel: "TRANSFERENCIA",
      causeSlot: "[ CAUSA ]",
    },
    phone: {
      header: "TU MARCA · PREMIOS",
      points: "1,250 pts",
      payoutTitle: "🎉 ¡Tienes un payout!",
      payoutSub: "Por participar. Elige cómo cobrarlo:",
      options: [
        { name: "Gift card", meta: "+2,000 MARCAS" },
        { name: "Cash directo", meta: "✓ ELEGIDO" },
        { name: "Prepagada", meta: "VIRTUAL O FÍSICA" },
        { name: "Donación", meta: "ELIGE CAUSA" },
      ],
      more: "…y muchas opciones más en su país",
      cta: "Cobrar ahora",
    },
  },

  mundoPropio: {
    pill: "Único en la categoría",
    titleLead: "La única plataforma con",
    titleMark: "mundo propio",
    body: "Siete personajes rubber-hose y un universo visual que le da vida a cada campaña. La competencia vende plantillas genéricas; nosotros ponemos personalidad — o la guardamos para que tu marca brille sola. Tú decides.",
  },

  promo: {
    pill: "En video",
    titleLead: "Supergana en",
    titleMark: "52 segundos",
    body: "Qué hacemos, cómo se ve con tu marca encima y por qué tu gente vuelve a jugar. Sin slides.",
    frameLabel: "PROMO",
    frameLabelLong: " · SUPERGANA",
    trackLabel: "Idioma del video",
    /** `{lang}` is replaced with the selected track's own label. */
    play: "Reproducir el video promocional en {lang}",
  },

  operamosTodo: {
    titleLead: "Tú pones la marca.",
    titleMark: "Nosotros, todo lo demás.",
    sticker: "LLAVE EN MANO",
    bullets: [
      {
        title: "Diseño y montaje",
        body: "Tu campaña lista en días, con tu identidad.",
      },
      {
        title: "Operación completa",
        body: "Nosotros la corremos de inicio a fin; tú ves el dashboard.",
      },
      {
        title: "Premios y entrega",
        body: "Del catálogo al ganador, sin logística de tu lado.",
      },
      {
        title: "Reglas y cumplimiento",
        body: "Reglas oficiales, aviso PROFECO y entrada gratuita alternativa donde aplique. Resuelto antes de lanzar.",
      },
    ],
  },

  casos: {
    titleLead: "Ya está",
    titleMark: "pasando",
    badge: "MUNDIAL 2026 · CASO REAL",
    title: "Quiniela Mundial × Rotary",
    body: "Quiniela del Mundial 2026 con causa benéfica, para el Rotary Club de Ciudad Juárez: la comunidad predice, compite, y lo recaudado se convierte en impacto real.",
    stats: ["116 boletos", "$11,600 USD recaudados", "75% directo a la causa"],
    illustrationSlot: "ILUSTRACIÓN — PERSONAJES EN EL ESTADIO",
    illustrationAlt:
      "Personajes de Supergana celebrando en las gradas de un estadio",
    yourBrandTitle: "Tu marca aquí",
    yourBrandBody:
      "Así se vería la tuya. Agenda una demo y te la enseñamos con tu logo.",
    cta: "Agenda tu demo",
  },

  ctaFinal: {
    title: "¿Jugamos?",
    body: "Cuéntanos tu objetivo en una llamada de 30 minutos y te enseñamos cómo se vería tu campaña.",
    cta: "Agenda tu demo",
    micro: "Llamada de 30 minutos · sin compromiso",
  },

  footer: {
    links: [
      { href: "#modulos", label: "Módulos" },
      { href: "#casos", label: "Casos" },
    ],
    contact: "Contacto",
    rights: "© 2026 Supergana",
  },
};

/**
 * The contract every locale file must satisfy. Derived from the Spanish object
 * rather than hand-written so the two can never drift apart.
 */
export type LandingCopy = typeof es;

/**
 * The pick'em's guided tour, as data.
 *
 * NO "use client" DIRECTIVE, for the reason cast.ts documents at length about
 * itself: the layout is a server component and it calls this at request time.
 * Every export of a client module becomes a client reference, and calling one
 * from the server fails at request time — a runtime failure `next build` does
 * not catch, because the build only type-checks and compiles the call.
 *
 * WHY THE NUMBERS ARE INTERPOLATED AND NOT TYPED OUT.
 *
 * reglas/page.tsx sets the rule this file obeys: every number a player reads is
 * taken from the programme, because prose is a second copy of the rules and the
 * first time a tenant reconfigures their programme the second copy starts
 * lying. `mechanics.hit` below is the same field the portada already prints on
 * `.pk-match-pts` and the rules screen prints as `+{m.hit}`. Change the
 * programme and all three change together.
 *
 * WHY THE TOUR NEVER WALKS TO THE PLAY SCREEN.
 *
 * `/jornada/{n}/` is gated server-side: a visitor who has not confirmed a phone
 * gets "Primero, tu número" (jornada/[semana]/page.tsx:64-96). That is a wall,
 * not a step — routing a stranger into it would end the tour on a form. So the
 * gesture is shown INSIDE the card instead, by the `pick-demo` slot, while the
 * spotlight sits on the Jugar tab so the player knows where it lives. Any step
 * anyone adds under /jornada/ later must be `optional: true`.
 *
 * WHY SIX SENTENCES ARE COPIED VERBATIM.
 *
 * They are already load-bearing somewhere else, and a tour that paraphrases the
 * rules is a tour that will eventually contradict them. Each one carries the
 * file and line it came from. The real fix is a shared copy module; introducing
 * one means editing six screens to ship a tour, which is the wrong trade today
 * and a debt worth naming.
 */

import type { TourDefinition } from "@/lib/platform/tour";
import type { Program } from "@/lib/pickem/schema";

/** Bump to show the tour again to everyone who already finished it. */
const TOUR_VERSION = 1;

export const pickemTour = (program: Program): TourDefinition => {
  const base = `/p/${program.slug}/`;

  return {
    id: "pickem",
    scope: program.slug,
    version: TOUR_VERSION,
    labels: {
      title: "Recorrido del Pick'em",
      next: "Siguiente",
      back: "Atrás",
      skip: "Saltar",
      done: "Entendido",
      progress: "Paso {n} de {total}",
      replay: "Ver el recorrido otra vez",
    },
    steps: [
      {
        id: "bienvenida",
        anchor: null,
        href: base,
        title: "Te doy el recorrido",
        body: [
          `Esto es el Pick'em de ${program.orgName}. Son ${program.totalWeeks} jornadas: pronosticas quién gana cada partido y sumas puntos.`,
          "Dos minutos y ya sabes cómo funciona.",
        ],
        art: "bandana-portada",
        artSize: 104,
        optional: false,
      },
      {
        id: "cierre",
        anchor: "portada-countdown",
        href: base,
        // The countdown only renders when the week has a lockAt and at least one
        // game (page.tsx:89). A programme whose schedule has not landed yet has
        // no card here, and the tour must not stall on it.
        optional: true,
        radius: 16,
        title: "Los picks cierran al kickoff", // verbatim, reglas/page.tsx:193
        // One paragraph, not two. The countdown card is 181px tall in a 677px
        // frame, so this step's card is capped to roughly 215px — the second
        // paragraph was arriving behind a scrollbar, which is a worse way to
        // read a sentence than not splitting it.
        body: [
          `Esto es lo que falta para que cierre la jornada ${program.openWeek}. Puedes cambiar tus picks hasta el primer kickoff.`, // segunda frase literal, SavedCelebration.tsx:152
        ],
      },
      {
        id: "jugar",
        anchor: "tab-jugar",
        href: base,
        // The shell renders the tabs on every player screen, so an absence here
        // is a bug rather than an empty state.
        optional: false,
        pad: 4,
        radius: 13,
        title: "Aquí armas tu jornada",
        body: [
          `Tocas el lado que crees que gana. Cada acierto suma ${program.mechanics.hit} puntos al acumulado.`,
          "Se envía la jornada completa, y la puedes cambiar hasta el primer kickoff.",
        ],
        slot: "pick-demo",
        art: "dino-picks",
        artSize: 86,
      },
      {
        id: "ranking",
        anchor: "ranking-table",
        href: `${base}ranking/`,
        optional: false,
        radius: 16,
        title: "Quién va ganando",
        body: [
          "El ranking es público: alias, sucursal y puntos. Nunca un teléfono ni un nombre real.",
          "Los resultados llegan el martes, cuando cierra la jornada.", // verbatim, SavedCelebration.tsx:151
        ],
        art: "bandana-ranking",
        artSize: 92,
      },
      {
        id: "premios",
        anchor: "premios-list",
        href: `${base}premios/`,
        optional: false,
        radius: 16,
        title: "Lo que está en juego", // the screen's own h1, premios/page.tsx:44
        // One paragraph, for the same reason step 2 has one: the prizes list is
        // 292px of a 547px screen and the page cannot scroll it any higher, so
        // the card is capped near 220px. Two paragraphs went behind a scrollbar.
        // No count and no promise either — the screen says "todavía no anuncia
        // los premios" when the catalogue is empty, and the tour must not
        // contradict the screen it is pointing at.
        body: [
          `Aquí aparece lo que ${program.orgName} pone en juego. Los premios se cobran en la mesa.`, // segunda frase literal, page.tsx:77
        ],
        art: "oso-premios",
        artSize: 92,
      },
      {
        id: "reglas",
        anchor: "head-reglas",
        // No href: the pill is in the header of every player screen, so this
        // step costs no navigation and says the true thing — the rules are
        // always within reach, wherever you are.
        href: null,
        optional: false,
        pad: 4,
        radius: 999,
        title: "Las reglas, siempre a la mano",
        body: [
          // ZERO NUMBERS HERE, deliberately. This is where the doctrine
          // resolves: the tour points at the rules instead of restating them.
          "Este botón está en todas las pantallas. Ahí están los puntos, los bonos, los multiplicadores y la vigencia de los premios, con los números reales de este programa.",
        ],
        art: "dino-reglas",
        artSize: 92,
      },
      {
        id: "entrar",
        anchor: "portada-cta",
        href: base,
        optional: false,
        title: "Ya está",
        body: [
          "Entras con tu WhatsApp, confirmas el código una vez y quedas dentro.",
          // The legal marker lands next to the sign-up CTA, which is where it
          // earns its place rather than reading as small print.
          "Un número por persona. Jugar es gratis y no requiere consumir.", // verbatim, reglas/page.tsx:253
        ],
        art: "goblin-acceso",
        artSize: 96,
      },
    ],
  };
};

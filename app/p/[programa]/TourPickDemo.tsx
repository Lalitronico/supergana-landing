"use client";

import { useState } from "react";

/**
 * The pick gesture, playable inside the tour card.
 *
 * WHY THIS EXISTS AT ALL. The screen where you actually play is gated: the
 * server sends anybody without a confirmed phone to "Primero, tu número"
 * (jornada/[semana]/page.tsx:64-96), so a stranger being toured cannot be shown
 * the real board. Describing a tap in prose is what the tour was written to
 * replace, so the tap happens here instead — the same markup, the same classes,
 * the same yellow "Tu pick" stamp as PicksBoard.tsx:114-127.
 *
 * WHY THERE ARE NO TEAMS. Two reasons, and the second is the one that matters.
 * Loading the week into the layout to borrow a real fixture would cost a query
 * on every navigation in the module, for one decorative row. And inventing two
 * teams would put fake sports data on a player's screen, which is the one thing
 * this project does not do — the tenant's players know the schedule better than
 * we do and a made-up matchup is the fastest way to look like a toy.
 *
 * So the sides are "Visitante" and "Local", which are not placeholders: they
 * are the actual vocabulary of the data model (`choice: "away" | "home"`) and
 * of the board. `--team` is deliberately left unset, so both tiles take the
 * neutral tint and the ONLY thing that changes on tap is the selection. That is
 * exactly the thing being taught.
 */
export function TourPickDemo({ hit }: { hit: number }) {
  const [picked, setPicked] = useState<"away" | "home" | null>(null);

  const side = (which: "away" | "home", name: string) => (
    <button
      type="button"
      className={`pk-side${picked === which ? " is-picked" : ""}`}
      onClick={() => setPicked(which)}
      aria-pressed={picked === which}
      aria-label={`Elegir ${name}`}
    >
      {picked === which ? <span className="pk-side-stamp">Tu pick</span> : null}
      <span className="pk-side-name">{name}</span>
      <span className="pk-side-city">Ejemplo</span>
    </button>
  );

  return (
    <div className="pk-match">
      <div className="pk-match-head">
        <span className="pk-match-no">Reto 01</span>
        {/* No kickoff: a time here would be invented, and the middle cell is the
            one the real row ellipsizes anyway. */}
        <span className="pk-match-when">Así se ve en la jornada</span>
        <span className="pk-match-pts">+{hit} pts</span>
      </div>
      <div className="pk-match-body">
        {side("away", "Visitante")}
        <div className="pk-at">
          <span className="pk-vs">VS</span>
          <span className="pk-at-hint">{picked ? "así" : "elige uno"}</span>
        </div>
        {side("home", "Local")}
      </div>
    </div>
  );
}

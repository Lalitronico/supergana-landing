import type { LandingCopy } from "@/lib/i18n";

/**
 * In-product mock for module 01 — a live match with a prediction open.
 *
 * The mocks are translated along with the page rather than left in Spanish:
 * they are the only look a prospect gets at the product before the demo call,
 * and a US buyer reading "¿Habrá penal en el partido?" inside the screenshot
 * undercuts the whole white-label claim.
 *
 * MEX/USA and the score stay as they are — country codes and numbers.
 */
export function QuinielaMock({
  copy,
}: {
  copy: LandingCopy["modulos"]["mocks"]["quiniela"];
}) {
  return (
    <div className="overflow-hidden rounded-[18px] border-[3px] border-ink bg-cream shadow-cartoon-md">
      <div className="flex justify-between border-b-[3px] border-ink bg-yellow px-3.5 py-2 text-[11px] font-extrabold tracking-[0.08em]">
        <span>{copy.tournament}</span>
        <span>{copy.matchday}</span>
      </div>

      <div className="flex items-center justify-between bg-ink px-4 py-3.5 text-cream">
        <span className="font-display text-xl">MEX</span>
        <span className="rounded-full border-2 border-cream bg-red px-3 py-[3px] text-xs font-extrabold">
          {copy.score}
        </span>
        <span className="font-display text-xl">USA</span>
      </div>

      <div className="grid gap-2.5 p-4">
        <p className="font-display m-0 text-base">{copy.question}</p>

        <div className="flex items-center justify-between rounded-xl border-[3px] border-ink bg-yellow px-3 py-2 text-sm font-bold">
          <span>{copy.optionYes}</span>
          <span className="rounded-full bg-ink px-2.5 py-0.5 text-[11px] font-extrabold text-yellow">
            +10
          </span>
        </div>
        <div className="flex items-center justify-between rounded-xl border-[3px] border-ink bg-pink px-3 py-2 text-sm font-bold">
          <span>{copy.optionNo}</span>
          <span className="rounded-full bg-ink px-2.5 py-0.5 text-[11px] font-extrabold text-cream">
            +8
          </span>
        </div>

        <div className="flex gap-2.5 text-xs font-extrabold">
          <span className="flex-1 rounded-[10px] border-[3px] border-ink bg-cream px-2.5 py-2">
            {copy.scoreLabel}
            <br />
            <span className="text-base">37 pts</span>
          </span>
          <span className="flex-1 rounded-[10px] border-[3px] border-ink bg-green px-2.5 py-2">
            {copy.rankLabel}
            <br />
            <span className="text-base">#3</span>
          </span>
        </div>
      </div>
    </div>
  );
}

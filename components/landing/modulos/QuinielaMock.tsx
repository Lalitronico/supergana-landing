/** In-product mock for module 01 — a live match with a prediction open. */
export function QuinielaMock() {
  return (
    <div className="overflow-hidden rounded-[18px] border-[3px] border-ink bg-cream shadow-cartoon-md">
      <div className="flex justify-between border-b-[3px] border-ink bg-yellow px-3.5 py-2 text-[11px] font-extrabold tracking-[0.08em]">
        <span>MUNDIAL 2026</span>
        <span>GRUPO A · J3</span>
      </div>

      <div className="flex items-center justify-between bg-ink px-4 py-3.5 text-cream">
        <span className="font-display text-xl">MEX</span>
        <span className="rounded-full border-2 border-cream bg-red px-3 py-[3px] text-xs font-extrabold">
          1 – 1 · 67&apos;
        </span>
        <span className="font-display text-xl">USA</span>
      </div>

      <div className="grid gap-2.5 p-4">
        <p className="font-display m-0 text-base">¿Habrá penal en el partido?</p>

        <div className="flex items-center justify-between rounded-xl border-[3px] border-ink bg-yellow px-3 py-2 text-sm font-bold">
          <span>Sí, claro</span>
          <span className="rounded-full bg-ink px-2.5 py-0.5 text-[11px] font-extrabold text-yellow">
            +10
          </span>
        </div>
        <div className="flex items-center justify-between rounded-xl border-[3px] border-ink bg-pink px-3 py-2 text-sm font-bold">
          <span>No</span>
          <span className="rounded-full bg-ink px-2.5 py-0.5 text-[11px] font-extrabold text-cream">
            +8
          </span>
        </div>

        <div className="flex gap-2.5 text-xs font-extrabold">
          <span className="flex-1 rounded-[10px] border-[3px] border-ink bg-cream px-2.5 py-2">
            TU PUNTAJE
            <br />
            <span className="text-base">37 pts</span>
          </span>
          <span className="flex-1 rounded-[10px] border-[3px] border-ink bg-green px-2.5 py-2">
            POSICIÓN
            <br />
            <span className="text-base">#3</span>
          </span>
        </div>
      </div>
    </div>
  );
}

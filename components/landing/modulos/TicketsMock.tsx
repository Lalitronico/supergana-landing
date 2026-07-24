/** In-product mock for module 02 — receipt upload plus a live leaderboard. */
export function TicketsMock() {
  return (
    <div className="overflow-hidden rounded-[18px] border-[3px] border-ink bg-cream shadow-cartoon-md">
      <div className="flex justify-between bg-ink px-4 py-2.5 text-xs font-extrabold tracking-[0.06em] text-cream">
        <span>CARRERA · TU MARCA</span>
        <span className="text-yellow">TERMINA EN 12 DÍAS</span>
      </div>

      <div className="grid gap-3 p-4">
        <div className="rounded-[14px] border-[3px] border-dashed border-ink bg-yellow p-[18px] text-center text-sm font-extrabold">
          📸 Sube tu ticket
          <br />
          <span className="text-[11px] font-semibold opacity-70">
            Cada compra suma puntos
          </span>
        </div>

        <div className="flex items-center justify-between rounded-xl border-[3px] border-ink bg-cream px-3 py-2 text-sm font-bold">
          <span>🥇 Marifer L.</span>
          <span className="font-extrabold">2,480 pts</span>
        </div>
        <div className="flex items-center justify-between rounded-xl border-[3px] border-ink bg-cream px-3 py-2 text-sm font-bold">
          <span>🥈 Beto R.</span>
          <span className="font-extrabold">2,210 pts</span>
        </div>
        <div className="flex items-center justify-between rounded-xl border-[3px] border-ink bg-blue px-3 py-2 text-sm font-extrabold text-cream shadow-[3px_3px_0_0_var(--color-ink)]">
          <span>🥉 TÚ</span>
          <span>2,190 pts · ¡a 21!</span>
        </div>
      </div>
    </div>
  );
}

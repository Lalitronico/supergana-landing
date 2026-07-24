const ITEMS = [
  { icon: "🎁", name: "Gift card $500", cost: "900 pts", tone: "bg-yellow text-ink" },
  { icon: "🎬", name: "Cine para 2", cost: "450 pts", tone: "bg-pink text-ink" },
  { icon: "💵", name: "Cash directo", cost: "1,200 pts", tone: "bg-blue text-cream" },
  { icon: "✈️", name: "Experiencia", cost: "2,000 pts", tone: "bg-cream text-ink" },
];

/** In-product mock for module 03 — points balance over a redemption grid. */
export function TiendaMock() {
  return (
    <div className="overflow-hidden rounded-[18px] border-[3px] border-ink bg-cream shadow-cartoon-md">
      <div className="flex items-center justify-between bg-ink px-4 py-2.5 text-xs font-extrabold tracking-[0.06em] text-cream">
        <span>TIENDA · TU MARCA</span>
        <span className="rounded-full border-2 border-cream bg-yellow px-2.5 py-[3px] text-ink">
          1,240 pts
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 p-4">
        {ITEMS.map((item) => (
          <div
            key={item.name}
            className={`rounded-xl border-[3px] border-ink p-3 text-center ${item.tone}`}
          >
            <div className="text-[26px]">{item.icon}</div>
            <p className="mb-0.5 mt-1.5 text-xs font-extrabold">{item.name}</p>
            <p className="m-0 text-[11px] font-bold opacity-70">{item.cost}</p>
          </div>
        ))}
      </div>

      <div className="mx-4 mb-4 rounded-xl border-[3px] border-ink bg-yellow p-2.5 text-center text-sm font-extrabold shadow-[3px_3px_0_0_var(--color-ink)]">
        Canjear ahora
      </div>
    </div>
  );
}

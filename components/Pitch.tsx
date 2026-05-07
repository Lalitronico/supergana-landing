export function Pitch() {
  const phrases = [
    "Tú eliges el momento.",
    "Nosotros entregamos la campaña.",
    "Tú eliges el momento.",
    "Nosotros entregamos la campaña.",
  ];

  return (
    <section className="overflow-hidden border-b-[3px] border-ink bg-ink py-7 text-cream">
      <div className="flex animate-[marquee_30s_linear_infinite] gap-12 whitespace-nowrap will-change-transform">
        {[...phrases, ...phrases].map((phrase, i) => (
          <span
            key={i}
            className={`font-display text-3xl tracking-tight md:text-5xl ${
              i % 2 === 1 ? "text-yellow" : "text-cream"
            }`}
          >
            {phrase}
            <span className="ml-12 text-pink">★</span>
          </span>
        ))}
      </div>
    </section>
  );
}

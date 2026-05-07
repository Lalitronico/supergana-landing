import { SocialMosaic } from "./kit/SocialMosaic";

export function WhatsIncluded() {
  return (
    <section
      id="kit"
      className="relative overflow-hidden border-b-[3px] border-ink bg-green py-24 md:py-32"
    >
      {/* Stadium turf stripes */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(10,10,10,0.06) 0px, rgba(10,10,10,0.06) 80px, transparent 80px, transparent 160px)",
        }}
      />
      {/* Field markings: center circle + halfway line */}
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full opacity-20"
        preserveAspectRatio="none"
        viewBox="0 0 1200 800"
      >
        {/* Halfway line */}
        <line
          x1="600"
          y1="0"
          x2="600"
          y2="800"
          stroke="#FAF7F0"
          strokeWidth="3"
          strokeDasharray="0"
        />
        {/* Center circle */}
        <circle
          cx="600"
          cy="400"
          r="120"
          fill="none"
          stroke="#FAF7F0"
          strokeWidth="3"
        />
        <circle cx="600" cy="400" r="6" fill="#FAF7F0" />
        {/* Penalty boxes (left & right) */}
        <rect
          x="0"
          y="240"
          width="180"
          height="320"
          fill="none"
          stroke="#FAF7F0"
          strokeWidth="3"
        />
        <rect
          x="1020"
          y="240"
          width="180"
          height="320"
          fill="none"
          stroke="#FAF7F0"
          strokeWidth="3"
        />
        {/* Goal areas */}
        <rect
          x="0"
          y="320"
          width="60"
          height="160"
          fill="none"
          stroke="#FAF7F0"
          strokeWidth="3"
        />
        <rect
          x="1140"
          y="320"
          width="60"
          height="160"
          fill="none"
          stroke="#FAF7F0"
          strokeWidth="3"
        />
        {/* Corner arcs */}
        <path
          d="M 0 20 A 20 20 0 0 1 20 0"
          fill="none"
          stroke="#FAF7F0"
          strokeWidth="3"
        />
        <path
          d="M 1180 0 A 20 20 0 0 1 1200 20"
          fill="none"
          stroke="#FAF7F0"
          strokeWidth="3"
        />
        <path
          d="M 0 780 A 20 20 0 0 0 20 800"
          fill="none"
          stroke="#FAF7F0"
          strokeWidth="3"
        />
        <path
          d="M 1180 800 A 20 20 0 0 0 1200 780"
          fill="none"
          stroke="#FAF7F0"
          strokeWidth="3"
        />
      </svg>
      {/* Subtle dot grain */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, #0A0A0A 1px, transparent 0)",
          backgroundSize: "22px 22px",
        }}
      />

      <div className="relative mx-auto max-w-7xl px-5 md:px-8">
        <div className="max-w-3xl">
          <span className="text-xs font-bold uppercase tracking-wider">
            Qué incluye el kit
          </span>
          <h2 className="font-display mt-3 text-4xl leading-tight md:text-6xl">
            Todo lo que tu activación necesita. En una caja.
          </h2>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed">
            Sin licencias raras. Sin onboarding de plataforma. Sin pelearte
            con un constructor de formularios. Esto es lo que vas a poder
            publicar mañana:
          </p>
        </div>

        <div className="mt-14 md:mt-20">
          <SocialMosaic />
        </div>
      </div>
    </section>
  );
}

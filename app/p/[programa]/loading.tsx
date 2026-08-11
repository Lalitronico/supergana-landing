/**
 * The screen a click paints while the real one is still being cooked.
 *
 * Every route in the module is dynamic, so without this file a tap on
 * "Entrar al juego" waited for the whole server round trip showing NOTHING —
 * on a cold Vercel function that is seconds of silence, and a button that
 * answers with silence reads as a button that does not work. That is not a
 * hypothetical: it came back from testing as "le doy y no cambia pantalla".
 *
 * The fallback also gives Next something to prefetch for links into dynamic
 * routes, which is what makes the swap immediate instead of merely eventual.
 *
 * It renders inside the module layout, so the phone frame and the tenant
 * header stay put; only the screen area pulses. Shapes echo the real screens
 * — an eyebrow, a display line, cards — so the swap lands where the eye
 * already is.
 */
export default function Loading() {
  return (
    <div className="sg-screen" aria-busy="true" aria-label="Cargando">
      <style>{`
        @keyframes pk-skel-pulse { 0%, 100% { opacity: 0.55; } 50% { opacity: 0.25; } }
        .pk-skel {
          background: var(--sg-ink-mute);
          border-radius: 10px;
          animation: pk-skel-pulse 1.1s ease-in-out infinite;
        }
      `}</style>
      <div className="sg-pad">
        <div className="pk-skel" style={{ width: 140, height: 12 }} />
        <div className="pk-skel" style={{ width: "70%", height: 34 }} />
        <div className="sg-card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="pk-skel" style={{ width: "45%", height: 12 }} />
          <div className="pk-skel" style={{ width: "85%", height: 18 }} />
          <div className="pk-skel" style={{ width: "60%", height: 12 }} />
        </div>
        <div className="sg-card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="pk-skel" style={{ width: "45%", height: 12 }} />
          <div className="pk-skel" style={{ width: "85%", height: 18 }} />
          <div className="pk-skel" style={{ width: "60%", height: 12 }} />
        </div>
      </div>
    </div>
  );
}

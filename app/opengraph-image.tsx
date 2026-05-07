import { ImageResponse } from "next/og";

export const dynamic = "force-static";
export const alt = "Supergana — Quinielas listas para tu marca";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#FFD93D",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px",
          fontFamily: "system-ui, sans-serif",
          color: "#0A0A0A",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 56,
            fontWeight: 800,
            letterSpacing: "-0.02em",
          }}
        >
          Supergana.
        </div>

        <div
          style={{
            display: "flex",
            fontSize: 96,
            fontWeight: 800,
            lineHeight: 1,
            letterSpacing: "-0.03em",
            maxWidth: 980,
          }}
        >
          La quiniela que tu marca necesita. Lista en días.
        </div>

        <div
          style={{
            display: "flex",
            fontSize: 28,
            fontWeight: 600,
            opacity: 0.85,
            maxWidth: 900,
          }}
        >
          Activación llave en mano para Mundial, finales y clásicos. Sin
          plataforma, sin formularios.
        </div>
      </div>
    ),
    { ...size }
  );
}

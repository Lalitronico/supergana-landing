/**
 * The cartoon fuel pump the whole campaign stands around: round globe, red
 * body, a dark display, a blue panel with a checker stripe and a hose.
 *
 * The display shows `digits` (the points a dollar earns, passed by the caller
 * from the campaign's data) in the green of an old pump readout. Decorative:
 * aria-hidden, the numbers are said in words everywhere it is used.
 */
export function GasPump({
  digits,
  height = 190,
  className,
}: {
  digits: string;
  height?: number | string;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 132 200"
      style={{ height, width: "auto" }}
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {/* hose and nozzle, behind the body */}
      <path
        d="M96 108c26 0 30 22 28 44-1 12-1 20-6 24"
        fill="none"
        stroke="#0A0A0A"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <path d="M112 172h14v18a4 4 0 0 1-4 4h-6a4 4 0 0 1-4-4z" fill="#FFD93D" stroke="#0A0A0A" strokeWidth="3.5" strokeLinejoin="round" />
      {/* globe */}
      <rect x="44" y="40" width="36" height="9" rx="2" fill="#0A0A0A" />
      <circle cx="62" cy="24" r="19" fill="#FFD93D" stroke="#0A0A0A" strokeWidth="4" />
      <path d="M50 18c3-5 8-7 13-6" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" opacity=".85" />
      {/* body */}
      <rect x="18" y="46" width="88" height="140" rx="14" fill="#FF4757" stroke="#0A0A0A" strokeWidth="4" />
      <path d="M26 56h72" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity=".5" />
      {/* display */}
      <rect x="30" y="64" width="64" height="38" rx="7" fill="#0A0A0A" />
      <text
        x="62"
        y="92"
        textAnchor="middle"
        fontFamily="var(--font-bricolage), system-ui, sans-serif"
        fontWeight="800"
        fontSize="28"
        fill="#2ECC71"
      >
        {digits}
      </text>
      {/* blue panel with checker */}
      <rect x="30" y="112" width="64" height="26" rx="6" fill="#1E90FF" stroke="#0A0A0A" strokeWidth="3.5" />
      <g fill="#fff" opacity=".9">
        <rect x="36" y="118" width="8" height="7" />
        <rect x="52" y="118" width="8" height="7" />
        <rect x="68" y="118" width="8" height="7" />
        <rect x="44" y="125" width="8" height="7" />
        <rect x="60" y="125" width="8" height="7" />
        <rect x="76" y="125" width="8" height="7" />
      </g>
      {/* skirt */}
      <rect x="18" y="150" width="88" height="18" fill="#FFD93D" stroke="#0A0A0A" strokeWidth="3.5" />
      <rect x="10" y="184" width="104" height="14" rx="5" fill="#0A0A0A" />
    </svg>
  );
}

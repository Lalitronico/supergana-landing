"use client";

import { useEffect, useState } from "react";
import { countdownTo, type Countdown as Parts } from "@/lib/pickem/schedule";

/**
 * Time left until the week locks.
 *
 * The first render uses `initial`, computed on the server, so the client's
 * first paint matches the HTML it hydrates — computing the countdown twice
 * against two clocks is a hydration mismatch that React logs as an error and a
 * user sees as a flicker. Only after mounting does it start ticking on the
 * browser's own clock.
 *
 * Seconds, not just days and hours: the last hour before kickoff is when most
 * picks arrive, and a display that stops at "0 h" during it looks broken.
 */
export function Countdown({
  target,
  initial,
  onDoneLabel = "Jornada cerrada",
}: {
  target: string;
  initial: Parts;
  onDoneLabel?: string;
}) {
  const [parts, setParts] = useState<Parts>(initial);

  useEffect(() => {
    const tick = () => setParts(countdownTo(target, new Date()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);

  if (parts.done) {
    return <div className="sg-eyebrow">{onDoneLabel}</div>;
  }

  const cells: [number, string][] = [
    [parts.days, "días"],
    [parts.hours, "horas"],
    [parts.minutes, "min"],
    [parts.seconds, "seg"],
  ];

  return (
    <div className="pk-countdown">
      {cells.map(([n, label]) => (
        <div className="pk-cd-cell" key={label}>
          <div className="pk-cd-n">{String(n).padStart(2, "0")}</div>
          <div className="pk-cd-l">{label}</div>
        </div>
      ))}
    </div>
  );
}

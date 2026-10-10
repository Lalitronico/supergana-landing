"use client";

import type { CSSProperties } from "react";
import type { CastMember } from "@/lib/tickets/theme";
import { useTickets } from "../TicketsShell";

/** Backdrops cycle through the system palette so the grid reads as a roster, not a spreadsheet. */
const TONES = ["var(--sg-yellow)", "var(--sg-pink)", "var(--sg-blue)", "var(--sg-green)", "var(--sg-orange)", "var(--sg-purple)"];

/**
 * "Elige tu personaje": the tenant's cast as a grid of busts. The picked one
 * bounces and grows; a preview line shows it next to the nickname exactly as the
 * race and the live screen will, which is the moment the choice stops being
 * abstract.
 *
 * Opt-in by data: the caller mounts it only when the theme has a cast. The
 * server validates the id against the same cast, so a doctored request cannot
 * store anything the screens cannot draw.
 */
export function CharacterPicker({
  cast,
  value,
  onChange,
  alias,
}: {
  cast: CastMember[];
  value: string | null;
  onChange: (id: string) => void;
  /** What the preview prints: the nickname, or the first name while the nickname is empty. */
  alias: string;
}) {
  const { t } = useTickets();
  const chosen = cast.find((m) => m.id === value) ?? null;

  return (
    <fieldset className="sh-pick">
      <legend className="sh-pick-title">{t("shPickTitle")}</legend>
      <p className="sh-pick-sub">{t("shPickSub")}</p>

      <div className="sh-pick-grid" role="radiogroup" aria-label={t("shPickTitle")}>
        {cast.map((member, i) => {
          const on = member.id === value;
          return (
            <button
              key={member.id}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={t("shPickAria", { name: member.name })}
              className={on ? "sh-pick-item on" : "sh-pick-item"}
              style={{ "--tone": TONES[i % TONES.length] } as CSSProperties}
              onClick={() => onChange(member.id)}
            >
              <span className="sh-pick-bust">
                {/* eslint-disable-next-line @next/next/no-img-element -- tenant art from data */}
                <img src={member.avatar ?? member.image} alt="" decoding="async" draggable={false} />
              </span>
              <span className="sh-pick-name">{member.name}</span>
            </button>
          );
        })}
      </div>

      {chosen && (
        <div className="sh-pick-preview" aria-live="polite">
          <span className="sh-pick-preview-label">{t("shPreview")}</span>
          <span className="sh-pick-preview-chip">
            {/* eslint-disable-next-line @next/next/no-img-element -- tenant art from data */}
            <img src={chosen.avatar ?? chosen.image} alt="" decoding="async" draggable={false} />
            <b>{alias.trim() || t("shPreviewAlias")}</b>
          </span>
        </div>
      )}
    </fieldset>
  );
}

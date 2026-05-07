"use client";

import { motion } from "framer-motion";
import {
  COPY,
  formatK,
  formatNum,
  type CounterState,
  type KitTag,
} from "@/lib/kitPosts";

const ease = [0.16, 1, 0.3, 1] as const;

function TagBadge({ tag, color }: { tag: KitTag; color: string }) {
  return (
    <span
      className={`absolute -top-3 -right-3 z-20 inline-flex items-center gap-1 rounded-full cartoon-border ${color} px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink shadow-[3px_3px_0_0_#0A0A0A]`}
    >
      {tag}
    </span>
  );
}

function Avatar({
  initial,
  bg,
  size = "h-8 w-8",
  ring,
}: {
  initial: string;
  bg: string;
  size?: string;
  ring?: boolean;
}) {
  return (
    <span
      className={`relative inline-flex ${size} shrink-0 items-center justify-center rounded-full cartoon-border ${bg} ${ring ? "ring-2 ring-pink ring-offset-2 ring-offset-cream" : ""}`}
    >
      <span className="font-display text-sm text-ink">{initial}</span>
    </span>
  );
}

/* ───────────────────── IG POST ───────────────────── */

export function IgPost({ counters }: { counters: CounterState }) {
  const heartPop = counters.tick % 4 === 0;
  return (
    <div className="relative overflow-hidden rounded-2xl cartoon-border cartoon-shadow-lg bg-cream">
      <TagBadge tag="Visuales" color="bg-yellow" />

      {/* Header */}
      <div className="flex items-center gap-2 border-b-[3px] border-ink px-3 py-2">
        <span className="relative inline-flex h-8 w-8 items-center justify-center rounded-full">
          <span className="absolute inset-0 rounded-full bg-gradient-to-tr from-yellow via-pink to-blue" />
          <span className="relative inline-flex h-6 w-6 items-center justify-center rounded-full bg-cream cartoon-border">
            <span className="font-display text-[10px]">T</span>
          </span>
        </span>
        <div className="flex-1 leading-tight">
          <span className="block text-xs font-bold">{COPY.igPost.handle}</span>
          <span className="block text-[9px] uppercase tracking-wider text-ink/60">
            {COPY.igPost.sponsored}
          </span>
        </div>
        <span className="text-base text-ink">⋯</span>
      </div>

      {/* Visual */}
      <div className="relative aspect-square w-full overflow-hidden bg-yellow">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, #0A0A0A 1px, transparent 0)",
            backgroundSize: "12px 12px",
          }}
        />
        <div className="relative flex h-full flex-col justify-between p-4">
          <span className="inline-flex w-fit rounded-full cartoon-border bg-ink px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-cream">
            ★ {COPY.igPost.subhead}
          </span>
          <div className="text-center">
            <h3 className="font-display text-3xl leading-none">
              {COPY.igPost.headline}
            </h3>
            <p className="font-display mt-1 text-sm text-ink/70">
              {COPY.igPost.cta}
            </p>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-display text-[10px] uppercase tracking-wider">
              tumarca<span className="text-red">.</span>
            </span>
            <motion.span
              className="text-2xl"
              animate={{ rotate: [0, -8, 8, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              aria-hidden
            >
              ⚽
            </motion.span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="px-3 py-2">
        <div className="flex items-center gap-3 text-lg">
          <motion.span
            aria-hidden
            animate={heartPop ? { scale: [1, 1.4, 1] } : { scale: 1 }}
            transition={{ duration: 0.5, ease }}
          >
            ❤️
          </motion.span>
          <span aria-hidden>💬</span>
          <span aria-hidden>✈️</span>
          <span className="ml-auto" aria-hidden>
            🔖
          </span>
        </div>
        <p className="mt-1 text-[11px] font-bold">
          <motion.span
            key={counters.igLikes}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {formatNum(counters.igLikes)}
          </motion.span>{" "}
          me gusta
        </p>
        <p className="mt-1 text-[11px] leading-snug">
          <span className="font-bold">tumarca.mx</span> {COPY.igPost.caption}
        </p>
      </div>
    </div>
  );
}

/* ───────────────────── IG STORY ───────────────────── */

export function IgStory({ counters }: { counters: CounterState }) {
  const segments = 5;
  const currentSeg = 1;
  return (
    <div className="relative flex h-full min-h-[460px] flex-col overflow-hidden rounded-2xl cartoon-border cartoon-shadow-lg bg-ink text-cream">
      <TagBadge tag="Reglas" color="bg-pink" />

      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0F4D2A] via-green to-[#0F4D2A]" />
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.1]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, #FAF7F0 1px, transparent 0)",
          backgroundSize: "10px 10px",
        }}
      />

      <div className="relative flex h-full flex-col p-3">
        {/* Progress bars */}
        <div className="flex gap-1">
          {Array.from({ length: segments }).map((_, i) => (
            <div
              key={i}
              className="relative h-0.5 flex-1 overflow-hidden rounded-full bg-cream/30"
            >
              {i < currentSeg && (
                <div className="absolute inset-0 bg-cream" />
              )}
              {i === currentSeg && (
                <motion.div
                  className="absolute inset-y-0 left-0 bg-cream"
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{
                    duration: 5,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                />
              )}
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="mt-2 flex items-center gap-2">
          <Avatar initial="T" bg="bg-yellow" size="h-7 w-7" />
          <div className="flex-1 leading-tight">
            <span className="block text-[11px] font-bold">
              {COPY.igStory.handle}
            </span>
            <span className="block text-[9px] text-cream/70">
              {COPY.igStory.timeAgo}
            </span>
          </div>
          <span className="text-[11px]">{formatK(counters.igStoryViews)} 👁</span>
        </div>

        {/* Title + compact rules */}
        <div className="mt-3">
          <h4 className="font-display text-base leading-tight text-cream">
            {COPY.igStory.title}
          </h4>
          <ul className="mt-2 space-y-1.5">
            {COPY.igStory.rules.map((rule) => (
              <li
                key={rule.text}
                className="flex items-center gap-2 rounded-lg cartoon-border bg-cream/95 px-2 py-1.5 text-[11px] font-semibold text-ink"
              >
                <span aria-hidden>{rule.icon}</span>
                <span>{rule.text}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* PRIZE HERO with trophy SVG */}
        <div className="mt-3 flex-1">
          <div className="relative h-full overflow-hidden rounded-2xl cartoon-border bg-yellow text-ink shadow-[3px_3px_0_0_#0A0A0A]">
            {/* Background pattern */}
            <div
              aria-hidden
              className="absolute inset-0 opacity-[0.18]"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(45deg, #0A0A0A 0 2px, transparent 2px 18px)",
              }}
            />

            {/* Sparkles */}
            <motion.span
              aria-hidden
              className="absolute left-3 top-3 text-base"
              animate={{ scale: [1, 1.3, 1], rotate: [0, 20, 0] }}
              transition={{ duration: 2.4, repeat: Infinity }}
            >
              ✨
            </motion.span>
            <motion.span
              aria-hidden
              className="absolute right-3 top-2 text-sm"
              animate={{ scale: [1, 1.4, 1], rotate: [0, -20, 0] }}
              transition={{ duration: 2.8, repeat: Infinity, delay: 0.4 }}
            >
              ⭐
            </motion.span>
            <motion.span
              aria-hidden
              className="absolute bottom-2 left-4 text-sm"
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ duration: 2.6, repeat: Infinity, delay: 0.8 }}
            >
              ✨
            </motion.span>
            <motion.span
              aria-hidden
              className="absolute bottom-3 right-3 text-base"
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
            >
              🎯
            </motion.span>

            <div className="relative flex h-full flex-col items-center justify-center px-3 py-3 text-center">
              <span className="font-display inline-flex items-center gap-1 rounded-full cartoon-border bg-ink px-2 py-0.5 text-[9px] uppercase tracking-wider text-yellow">
                ★ Sorteo top 10 ★
              </span>

              {/* Trophy SVG */}
              <motion.svg
                viewBox="0 0 80 90"
                className="mt-2 h-20 w-20"
                animate={{ y: [0, -4, 0], rotate: [-3, 3, -3] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                aria-hidden
              >
                {/* Cup body */}
                <path
                  d="M 22 12 L 58 12 L 56 38 Q 56 50 40 50 Q 24 50 24 38 Z"
                  fill="#F5C211"
                  stroke="#0A0A0A"
                  strokeWidth="3"
                  strokeLinejoin="round"
                />
                {/* Highlight */}
                <path
                  d="M 28 18 L 30 38 Q 30 44 36 46"
                  fill="none"
                  stroke="#FAF7F0"
                  strokeWidth="2"
                  strokeLinecap="round"
                  opacity="0.7"
                />
                {/* Left handle */}
                <path
                  d="M 22 16 Q 12 18 12 28 Q 12 36 22 36"
                  fill="none"
                  stroke="#0A0A0A"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
                {/* Right handle */}
                <path
                  d="M 58 16 Q 68 18 68 28 Q 68 36 58 36"
                  fill="none"
                  stroke="#0A0A0A"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
                {/* Stem */}
                <rect
                  x="36"
                  y="50"
                  width="8"
                  height="14"
                  fill="#F5C211"
                  stroke="#0A0A0A"
                  strokeWidth="3"
                />
                {/* Base */}
                <rect
                  x="24"
                  y="64"
                  width="32"
                  height="10"
                  rx="2"
                  fill="#F5C211"
                  stroke="#0A0A0A"
                  strokeWidth="3"
                />
                <rect
                  x="20"
                  y="74"
                  width="40"
                  height="8"
                  rx="2"
                  fill="#0A0A0A"
                />
                {/* Star */}
                <text
                  x="40"
                  y="34"
                  fontSize="14"
                  textAnchor="middle"
                  fill="#0A0A0A"
                  fontWeight="900"
                >
                  1
                </text>
              </motion.svg>

              <h5 className="font-display mt-1 text-lg leading-none">
                AirPods Pro
              </h5>
              <p className="mt-0.5 text-[10px] font-bold">
                + Cashback $500 MXN
              </p>
            </div>
          </div>
        </div>

        {/* Countdown */}
        <div className="mt-2 flex items-center justify-between rounded-xl cartoon-border bg-cream/95 px-2.5 py-1.5 text-ink shadow-[3px_3px_0_0_#0A0A0A]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-ink/70">
            ⏰ Cierra en
          </span>
          <span className="font-display flex items-center gap-1 text-sm leading-none">
            <span>02h</span>
            <span className="opacity-40">:</span>
            <span>14m</span>
            <span className="opacity-40">:</span>
            <motion.span
              key={counters.tick}
              initial={{ opacity: 0, y: -3 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-block w-7 text-center"
            >
              {String(33 - (counters.tick * 2) % 33).padStart(2, "0")}s
            </motion.span>
          </span>
        </div>

        {/* Poll sticker */}
        <div className="mt-2 rounded-2xl cartoon-border bg-cream p-2 text-ink shadow-[3px_3px_0_0_#0A0A0A]">
          <p className="text-center text-[10px] font-bold uppercase tracking-wider">
            {COPY.igStory.pollQuestion}
          </p>
          <div className="mt-1.5 grid grid-cols-2 gap-1">
            <div className="rounded-md cartoon-border bg-yellow px-1.5 py-1 text-center text-[10px] font-bold">
              {COPY.igStory.pollOptionA.label}{" "}
              <span className="opacity-70">
                {COPY.igStory.pollOptionA.percent}%
              </span>
            </div>
            <div className="rounded-md cartoon-border bg-cream px-1.5 py-1 text-center text-[10px] font-bold">
              {COPY.igStory.pollOptionB.label}{" "}
              <span className="opacity-70">
                {COPY.igStory.pollOptionB.percent}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────── X / TWITTER POST ───────────────────── */

export function XPost({ counters }: { counters: CounterState }) {
  return (
    <div className="relative overflow-hidden rounded-2xl cartoon-border cartoon-shadow-lg bg-cream">
      <TagBadge tag="Copys" color="bg-blue" />

      <div className="flex gap-2 p-3">
        <Avatar initial="T" bg="bg-yellow" size="h-9 w-9" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 text-xs">
            <span className="font-bold">{COPY.xPost.name}</span>
            <span aria-hidden className="text-blue">
              ✓
            </span>
            <span className="text-ink/60">
              {COPY.xPost.handle} · {COPY.xPost.timeAgo}
            </span>
            <motion.span
              className="ml-auto inline-flex items-center gap-1 rounded-full bg-red px-1.5 py-0.5 text-[8px] font-bold uppercase text-cream"
              animate={{ opacity: [1, 0.6, 1] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            >
              <span className="h-1 w-1 rounded-full bg-cream" />
              EN VIVO
            </motion.span>
          </div>
          <p className="mt-1 text-[11px] leading-snug">
            {COPY.xPost.text}{" "}
            <span className="font-semibold text-blue">{COPY.xPost.link}</span>{" "}
            🇲🇽⚽
          </p>

          {/* Mini visual attached */}
          <div className="mt-2 overflow-hidden rounded-xl border-2 border-ink bg-blue p-2 text-cream">
            <div className="flex items-center gap-2">
              <span className="font-display text-base leading-none">
                MEX vs USA
              </span>
              <span className="ml-auto rounded-full bg-cream px-1.5 py-0.5 text-[8px] font-bold text-ink">
                HOY 20:00
              </span>
            </div>
            <p className="mt-0.5 text-[9px] uppercase tracking-wider opacity-90">
              Quiniela en vivo · Premios
            </p>
          </div>

          {/* Stats */}
          <div className="mt-2 flex items-center gap-4 text-[10px] text-ink/70">
            <span className="flex items-center gap-1">
              <span aria-hidden>💬</span>
              <motion.span key={counters.xReplies}>
                {counters.xReplies}
              </motion.span>
            </span>
            <span className="flex items-center gap-1 text-green">
              <span aria-hidden>🔁</span>
              <motion.span key={counters.xRts} className="font-semibold">
                {counters.xRts}
              </motion.span>
            </span>
            <span className="flex items-center gap-1 text-red">
              <span aria-hidden>❤️</span>
              <motion.span key={counters.xLikes} className="font-semibold">
                {formatK(counters.xLikes)}
              </motion.span>
            </span>
            <span className="ml-auto flex items-center gap-1">
              <span aria-hidden>📊</span>
              24k
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────── FACEBOOK POST ───────────────────── */

export function FbPost({ counters }: { counters: CounterState }) {
  return (
    <div className="relative overflow-hidden rounded-2xl cartoon-border cartoon-shadow-lg bg-cream">
      <TagBadge tag="Leads" color="bg-blue" />

      {/* Header */}
      <div className="flex items-center gap-2 border-b-2 border-ink/10 px-3 py-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-md cartoon-border bg-[#1877F2] text-cream">
          <span className="font-display text-base">f</span>
        </span>
        <div className="flex-1 leading-tight">
          <span className="block text-xs font-bold">{COPY.fbPost.name}</span>
          <span className="block text-[9px] text-ink/60">
            {COPY.fbPost.label} · 🌎
          </span>
        </div>
        <span className="text-base text-ink/60">⋯</span>
      </div>

      <div className="px-3 py-2">
        <p className="text-[11px] leading-snug">{COPY.fbPost.body}</p>

        {/* Lead form mockup */}
        <div className="mt-2 overflow-hidden rounded-xl border-2 border-ink bg-cream">
          <div className="border-b-2 border-ink bg-yellow px-3 py-1.5">
            <p className="text-[10px] font-bold uppercase tracking-wider">
              📋 {COPY.fbPost.formTitle}
            </p>
          </div>
          <div className="space-y-1.5 p-2">
            {COPY.fbPost.fields.map((f) => (
              <div
                key={f.label}
                className="rounded-md border-2 border-ink/20 bg-cream px-2 py-1"
              >
                <span className="block text-[8px] uppercase tracking-wider text-ink/50">
                  {f.label}
                </span>
                <span className="block text-[10px] text-ink/40">
                  {f.placeholder}
                </span>
              </div>
            ))}
            <motion.button
              type="button"
              className="w-full rounded-md cartoon-border bg-yellow px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider"
              animate={{ scale: [1, 1.02, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              {COPY.fbPost.cta} →
            </motion.button>
          </div>
        </div>

        {/* Reactions */}
        <div className="mt-2 flex items-center gap-1 text-[10px] text-ink/70">
          <span className="flex -space-x-1">
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue text-[8px]">
              👍
            </span>
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-red text-[8px]">
              ❤️
            </span>
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-yellow text-[8px]">
              🔥
            </span>
          </span>
          <motion.span key={counters.fbReactions} className="ml-1">
            {formatNum(counters.fbReactions)}
          </motion.span>
          <span className="ml-auto">
            <motion.span key={counters.fbComments}>
              {counters.fbComments}
            </motion.span>{" "}
            comentarios ·{" "}
            <motion.span key={counters.fbShares}>
              {counters.fbShares}
            </motion.span>{" "}
            comp.
          </span>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────── WHATSAPP SHARE ───────────────────── */

export function WaShare({ counters }: { counters: CounterState }) {
  const showTyping = counters.tick % 6 < 3;
  return (
    <div className="relative overflow-hidden rounded-2xl cartoon-border cartoon-shadow-lg bg-[#ECE5DD]">
      <TagBadge tag="Link público" color="bg-green" />

      {/* Header */}
      <div className="flex items-center gap-2 bg-[#075E54] px-3 py-2 text-cream">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-cream cartoon-border">
          <span className="font-display text-xs text-ink">M</span>
        </span>
        <div className="flex-1 leading-tight">
          <span className="block text-xs font-bold">{COPY.waShare.contact}</span>
          <span className="block text-[9px] opacity-80">
            {showTyping ? COPY.waShare.typing : COPY.waShare.status}
          </span>
        </div>
        <span className="text-sm">📞</span>
      </div>

      {/* Chat area */}
      <div
        className="relative space-y-2 px-3 py-3"
        style={{
          backgroundImage:
            "radial-gradient(circle at 2px 2px, rgba(10,10,10,0.05) 1px, transparent 0)",
          backgroundSize: "16px 16px",
        }}
      >
        <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm border-2 border-ink bg-[#DCF8C6] p-2 shadow-[2px_2px_0_0_#0A0A0A]">
          <p className="text-[11px] leading-snug text-ink">
            {COPY.waShare.bubble}
          </p>

          {/* Link preview card */}
          <div className="mt-1.5 overflow-hidden rounded-md border-2 border-ink bg-cream">
            <div className="flex h-12 items-center justify-center bg-yellow">
              <span className="font-display text-xs">⚽ MEX vs USA</span>
            </div>
            <div className="p-1.5">
              <p className="text-[9px] font-bold uppercase tracking-wider">
                {COPY.waShare.linkTitle}
              </p>
              <p className="text-[8px] leading-tight text-ink/70">
                {COPY.waShare.linkDesc}
              </p>
              <p className="mt-1 text-[8px] text-blue">{COPY.waShare.linkUrl}</p>
            </div>
          </div>

          <div className="mt-1 flex items-center justify-end gap-1 text-[8px] text-ink/60">
            <span>{COPY.waShare.time}</span>
            <span className="text-blue">✓✓</span>
          </div>
        </div>

        {showTyping && (
          <motion.div
            className="flex items-center gap-1 rounded-2xl rounded-bl-sm border-2 border-ink bg-cream px-2 py-1.5 w-fit"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="block h-1.5 w-1.5 rounded-full bg-ink/40"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{
                  duration: 1.2,
                  repeat: Infinity,
                  delay: i * 0.15,
                }}
              />
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}

/* ───────────────────── METRICS DASHBOARD ───────────────────── */

export function MetricsDashboard({ counters }: { counters: CounterState }) {
  return (
    <div className="relative overflow-hidden rounded-2xl cartoon-border cartoon-shadow-lg bg-cream">
      <TagBadge tag="Métricas" color="bg-yellow" />

      {/* Header */}
      <div className="flex items-center gap-2 border-b-[3px] border-ink bg-ink px-3 py-2 text-cream">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-yellow text-ink">
          <span className="font-display text-xs">📊</span>
        </span>
        <div className="flex-1 leading-tight">
          <span className="block text-xs font-bold">
            {COPY.metrics.title}
          </span>
          <span className="block text-[9px] text-cream/70">
            {COPY.metrics.subtitle}
          </span>
        </div>
        <span className="inline-flex items-center gap-1 text-[9px] text-green">
          <motion.span
            className="block h-1.5 w-1.5 rounded-full bg-green"
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.4, repeat: Infinity }}
          />
          Live
        </span>
      </div>

      <div className="space-y-3 p-4 md:p-5">
        {/* KPI cards row */}
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
          <KpiCard
            label="Jugadores"
            value={formatNum(counters.metricsPlayers)}
            color="bg-yellow"
          />
          <KpiCard
            label="Engagement"
            value={`+${counters.metricsEngagement}%`}
            color="bg-pink"
          />
          <KpiCard
            label="Leads"
            value={formatNum(counters.metricsLeads)}
            color="bg-blue"
          />
          <KpiCard label="Retención" value="47%" color="bg-green" />
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {/* Bar chart - 2/3 width on desktop */}
          <div className="rounded-xl border-2 border-ink bg-cream p-3 md:col-span-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-wider text-ink/70">
                Jugadores por día
              </p>
              <span className="font-display text-xs text-green">
                ↗ +24% vs jornada pasada
              </span>
            </div>
            <div className="mt-3 flex h-32 items-end gap-2">
              {COPY.metrics.bars.map((bar, i) => (
                <div
                  key={bar.day}
                  className="flex h-full flex-1 flex-col items-center justify-end gap-1"
                >
                  <motion.div
                    className="w-full rounded-md border-2 border-ink bg-yellow"
                    initial={{ height: "0%" }}
                    whileInView={{ height: `${bar.value}%` }}
                    viewport={{ once: true, amount: 0.3 }}
                    transition={{
                      duration: 0.9,
                      delay: 0.4 + i * 0.08,
                      ease,
                    }}
                  />
                  <span className="text-[9px] font-semibold text-ink/60">
                    {bar.day}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Channels - 1/3 width on desktop */}
          <div className="rounded-xl border-2 border-ink bg-cream p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-ink/70">
              Canales top
            </p>
            <div className="mt-2 space-y-2">
              {COPY.metrics.channels.map((c) => (
                <div key={c.name}>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="font-semibold">{c.name}</span>
                    <span className="font-display text-xs">{c.percent}%</span>
                  </div>
                  <div className="mt-0.5 h-2 overflow-hidden rounded-full border-2 border-ink bg-cream">
                    <motion.div
                      className={`h-full ${c.color}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${c.percent}%` }}
                      transition={{ duration: 1, ease }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className={`rounded-xl cartoon-border ${color} px-3 py-2`}>
      <span className="block text-[10px] font-bold uppercase tracking-wider text-ink/70">
        {label}
      </span>
      <motion.span
        key={value}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className="font-display block text-xl leading-tight md:text-2xl"
      >
        {value}
      </motion.span>
    </div>
  );
}

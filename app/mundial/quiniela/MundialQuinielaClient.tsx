"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { quinielaAsset } from "@/lib/config";
import { STAGE_LABELS, STRIPE_PAYMENT_LINK, type Stage } from "@/lib/mundial/config";
import {
  MUNDIAL_TEAMS,
  QUARTERFINALS,
  SEMIFINALS,
  ALIVE_TEAMS,
  teamById,
  type MundialTeamId,
} from "@/lib/mundial/teams";
import { mundialAnswersSchema, type MundialAnswers } from "@/lib/mundial/schema";
import {
  FINAL_ENDINGS,
  FINAL_STARS,
  TOP_SCORER_CANDIDATES,
  finalEndingLabel,
  finalStarLabel,
  topScorerLabel,
} from "@/lib/mundial/players";
import { QuinielaIntro } from "@/components/mundial/QuinielaIntro";

type Gate =
  | { state: "loading" }
  | { state: "intro" }
  | { state: "invalid"; message: string }
  | { state: "used" }
  | { state: "ready"; ticket: string; email: string | null; eligible: Stage[] };

interface Score {
  home: number;
  away: number;
}

interface Draft {
  fullName: string;
  email: string;
  phone: string;
  acceptedRules: boolean;
  qf: Partial<Record<"qf1" | "qf2" | "qf3" | "qf4", MundialTeamId>>;
  sf1: MundialTeamId | null;
  sf2: MundialTeamId | null;
  champion: MundialTeamId | null;
  tbCuartos: Score;
  tbSemis: Score;
  tbFinal: Score;
  topScorer: string | null;
  finalStar: string | null;
  finalEnding: string | null;
}

const EMPTY_DRAFT: Draft = {
  fullName: "",
  email: "",
  phone: "",
  acceptedRules: false,
  qf: {},
  sf1: null,
  sf2: null,
  champion: null,
  tbCuartos: { home: 1, away: 1 },
  tbSemis: { home: 1, away: 1 },
  tbFinal: { home: 1, away: 1 },
  topScorer: null,
  finalStar: null,
  finalEnding: null,
};

const STEPS = ["Tus datos", "Cuartos", "Semifinales", "Campeón"] as const;

export function MundialQuinielaClient() {
  const params = useSearchParams();
  const [gate, setGate] = useState<Gate>({ state: "loading" });
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState<{ eligible: Stage[] } | null>(null);

  useEffect(() => {
    const ticket = params.get("ticket");
    const sessionId = params.get("session_id");

    // Localhost-only preview of the form without a paid ticket, so the whole
    // quiniela can be reviewed before launch. Inert in production: the host is
    // never localhost there, and submitting a "preview" ticket 404s server-side.
    const isLocalhost =
      typeof window !== "undefined" &&
      ["localhost", "127.0.0.1"].includes(window.location.hostname);
    if (params.get("preview") === "1" && isLocalhost) {
      setGate({
        state: "ready",
        ticket: "preview",
        email: null,
        eligible: ["cuartos", "semis", "final"],
      });
      return;
    }

    const load = async () => {
      try {
        let resolvedTicket = ticket;
        if (!resolvedTicket && sessionId) {
          const res = await fetch(
            `/api/mundial/verify?session_id=${encodeURIComponent(sessionId)}`,
          );
          const data = await res.json();
          if (!res.ok) {
            setGate({ state: "invalid", message: data.error ?? "No pudimos validar tu pago." });
            return;
          }
          resolvedTicket = data.ticket;
          window.history.replaceState(null, "", `/mundial/quiniela/?ticket=${data.ticket}`);
        }
        if (!resolvedTicket) {
          setGate({ state: "intro" });
          return;
        }
        const res = await fetch(`/api/mundial/ticket?ticket=${encodeURIComponent(resolvedTicket)}`);
        const data = await res.json();
        if (!res.ok) {
          setGate({ state: "invalid", message: data.error ?? "Boleto no válido." });
          return;
        }
        if (data.used) {
          setGate({ state: "used" });
          return;
        }
        setGate({
          state: "ready",
          ticket: data.ticket,
          email: data.email,
          eligible: data.eligibleStages,
        });
        if (data.email) {
          setDraft((d) => ({ ...d, email: d.email || data.email }));
        }
      } catch {
        setGate({ state: "invalid", message: "Error de conexión. Recarga la página." });
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const answers: MundialAnswers | null = useMemo(() => {
    const parsed = mundialAnswersSchema.safeParse({
      qf1: draft.qf.qf1,
      qf2: draft.qf.qf2,
      qf3: draft.qf.qf3,
      qf4: draft.qf.qf4,
      sf1: draft.sf1,
      sf2: draft.sf2,
      champion: draft.champion,
      tiebreakers: {
        cuartos: draft.tbCuartos,
        semis: draft.tbSemis,
        final: draft.tbFinal,
      },
      topScorer: draft.topScorer,
      finalStar: draft.finalStar,
      finalEnding: draft.finalEnding,
    });
    return parsed.success ? parsed.data : null;
  }, [draft]);

  const stepValid = (i: number): boolean => {
    if (i === 0) {
      return (
        draft.fullName.trim().length >= 2 &&
        /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(draft.email.trim()) &&
        draft.phone.trim().length >= 7 &&
        draft.acceptedRules
      );
    }
    if (i === 1) return QUARTERFINALS.every((m) => draft.qf[m.id]);
    if (i === 2) return Boolean(draft.sf1 && draft.sf2);
    return Boolean(draft.champion && answers);
  };

  const submit = async () => {
    if (gate.state !== "ready" || !answers) return;
    // Preview mode: don't hit the server (the "preview" ticket isn't real);
    // just show the confirmation with the entered answers.
    if (gate.ticket === "preview") {
      setDone({ eligible: gate.eligible });
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/mundial/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticket: gate.ticket,
          fullName: draft.fullName.trim(),
          email: draft.email.trim().toLowerCase(),
          phone: draft.phone.trim(),
          acceptedRules: true,
          answers,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error ?? "No pudimos guardar tu quiniela. Intenta de nuevo.");
        return;
      }
      setDone({ eligible: data.eligibleStages });
    } catch {
      setSubmitError("Error de conexión. Revisa tu internet e intenta de nuevo.");
    } finally {
      setSubmitting(false);
    }
  };

  // Intro is a full-width themed page; render it without the form chrome.
  if (gate.state === "intro") {
    return (
      <>
        <CampaignHeader />
        <QuinielaIntro />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-cream">
      <CampaignHeader />

      <main className="mx-auto max-w-3xl px-5 py-10 pb-24">
        {gate.state === "loading" ? (
          <Panel title="Validando tu boleto…">
            <div className="h-3 w-2/3 animate-pulse rounded-full bg-ink/10" />
          </Panel>
        ) : null}

        {gate.state === "invalid" ? (
          <Panel title="No pudimos validar tu acceso">
            <p>{gate.message}</p>
            <p className="mt-3 text-sm opacity-70">
              Si crees que es un error, escríbenos con tu comprobante de pago y
              lo resolvemos.
            </p>
          </Panel>
        ) : null}

        {gate.state === "used" ? (
          <Panel title="Este boleto ya jugó 🎉">
            <p>
              Ya registramos una quiniela con este boleto y las respuestas no
              se pueden editar. Si quieres volver a jugar, cada boleto nuevo es
              una participación más (y más donativo para la causa).
            </p>
            <a
              href={STRIPE_PAYMENT_LINK}
              className="btn-cartoon mt-6 inline-flex h-12 items-center rounded-full bg-red px-6 font-bold text-cream"
            >
              Comprar otro boleto →
            </a>
          </Panel>
        ) : null}

        {gate.state === "ready" && done ? (
          <Confirmacion draft={draft} answers={answers!} eligible={done.eligible} />
        ) : null}

        {gate.state === "ready" && !done ? (
          <>
            <EligibilityBanner eligible={gate.eligible} />

            <ol className="mt-8 flex gap-2">
              {STEPS.map((label, i) => (
                <li key={label} className="flex-1">
                  <button
                    type="button"
                    onClick={() => i < step && setStep(i)}
                    className={`w-full rounded-full border-[3px] border-ink px-2 py-2 text-xs font-black uppercase tracking-wide sm:text-sm ${
                      i === step ? "bg-yellow" : i < step ? "bg-green" : "bg-cream opacity-50"
                    }`}
                  >
                    {i + 1}. {label}
                  </button>
                </li>
              ))}
            </ol>

            <div className="mt-8">
              {step === 0 ? <PasoDatos draft={draft} setDraft={setDraft} /> : null}
              {step === 1 ? <PasoCuartos draft={draft} setDraft={setDraft} /> : null}
              {step === 2 ? <PasoSemis draft={draft} setDraft={setDraft} /> : null}
              {step === 3 ? (
                <PasoCampeon draft={draft} setDraft={setDraft} answers={answers} />
              ) : null}
            </div>

            {submitError ? (
              <p className="cartoon-border mt-6 rounded-2xl bg-red/10 p-4 font-bold text-red-deep">
                {submitError}
              </p>
            ) : null}

            <div className="mt-8 flex items-center justify-between gap-4">
              <button
                type="button"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                disabled={step === 0}
                className="btn-cartoon h-12 rounded-full bg-cream px-6 font-bold disabled:invisible"
              >
                ← Atrás
              </button>
              {step < STEPS.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setStep((s) => s + 1)}
                  disabled={!stepValid(step)}
                  className="btn-cartoon h-12 rounded-full bg-red px-6 font-bold text-cream disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Siguiente →
                </button>
              ) : (
                <button
                  type="button"
                  onClick={submit}
                  disabled={!stepValid(3) || submitting}
                  className="btn-cartoon h-12 rounded-full bg-green px-6 font-bold disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {submitting ? "Enviando…" : "Confirmar y enviar 🏆"}
                </button>
              )}
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}

function CampaignHeader() {
  return (
    <header className="border-b-[3px] border-ink bg-yellow">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Link href="/mundial/quiniela/" className="font-display text-xl">
          Quiniela Mundialista <span className="text-red">·</span> Rotary
        </Link>
        <span className="cartoon-border hidden rounded-full bg-cream px-3 py-1 text-xs font-black uppercase sm:block">
          A beneficio de Rotary Cd. Juárez
        </span>
      </div>
    </header>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="cartoon-border cartoon-shadow-lg rounded-2xl bg-cream p-8">
      <h1 className="font-display text-3xl">{title}</h1>
      <div className="mt-4 leading-relaxed">{children}</div>
    </div>
  );
}

function EligibilityBanner({ eligible }: { eligible: Stage[] }) {
  const all: Stage[] = ["cuartos", "semis", "final"];
  const missed = all.filter((s) => !eligible.includes(s));
  return (
    <div className="cartoon-border rounded-2xl bg-blue/10 p-4 text-sm font-bold">
      {missed.length === 0 ? (
        <>Compites por los premios de las 3 etapas: cuartos, semifinales y final. 🔥</>
      ) : (
        <>
          Las etapas ya iniciadas quedan fuera ({missed.map((s) => STAGE_LABELS[s]).join(", ")}),
          pero aún compites en: {eligible.map((s) => STAGE_LABELS[s]).join(", ") || "ninguna"}.
          Llena toda tu quiniela de todos modos.
        </>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-black uppercase tracking-wide">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

const inputClass =
  "w-full rounded-xl border-[3px] border-ink bg-cream px-4 py-3 font-medium outline-none focus:bg-yellow/20";

function PasoDatos({
  draft,
  setDraft,
}: {
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft>>;
}) {
  return (
    <section className="space-y-5">
      <h2 className="font-display text-3xl">Tus datos</h2>
      <Field label="Nombre completo">
        <input
          className={inputClass}
          value={draft.fullName}
          onChange={(e) => setDraft((d) => ({ ...d, fullName: e.target.value }))}
          placeholder="Como quieres aparecer si ganas"
          autoComplete="name"
        />
      </Field>
      <Field label="Correo electrónico">
        <input
          className={inputClass}
          type="email"
          value={draft.email}
          onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
          placeholder="Aquí llega tu confirmación"
          autoComplete="email"
        />
      </Field>
      <Field label="Teléfono / WhatsApp">
        <input
          className={inputClass}
          type="tel"
          value={draft.phone}
          onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
          placeholder="Para avisarte si ganas"
          autoComplete="tel"
        />
      </Field>
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={draft.acceptedRules}
          onChange={(e) => setDraft((d) => ({ ...d, acceptedRules: e.target.checked }))}
          className="mt-1 h-5 w-5 accent-[#FF4757]"
        />
        <span className="text-sm leading-relaxed">
          Acepto las reglas de la campaña y entiendo que es una campaña de
          donativo a beneficio del Rotary Club Ciudad Juárez: 75% a la causa y
          25% a premios.
        </span>
      </label>
    </section>
  );
}

function TeamButton({
  teamId,
  selected,
  onSelect,
}: {
  teamId: MundialTeamId;
  selected: boolean;
  onSelect: () => void;
}) {
  const team = MUNDIAL_TEAMS[teamId];
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`btn-cartoon flex items-center gap-2 rounded-xl px-4 py-3 font-bold ${
        selected ? "bg-yellow" : "bg-cream"
      }`}
    >
      <span className="text-2xl">{team.flag}</span>
      <span>{team.name}</span>
      {selected ? <span className="ml-auto">✓</span> : null}
    </button>
  );
}

function PlayerButton({
  teamId,
  name,
  selected,
  onSelect,
}: {
  teamId: MundialTeamId;
  name: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const team = MUNDIAL_TEAMS[teamId];
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`btn-cartoon flex items-center gap-2 rounded-xl px-4 py-3 text-left font-bold ${
        selected ? "bg-yellow" : "bg-cream"
      }`}
    >
      <span className="text-2xl">{team.flag}</span>
      <span className="leading-tight">
        {name}
        <span className="block text-xs font-medium opacity-60">{team.name}</span>
      </span>
      {selected ? <span className="ml-auto">✓</span> : null}
    </button>
  );
}

function Stepper({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(Math.max(0, value - 1))}
        className="btn-cartoon h-10 w-10 rounded-full bg-cream text-xl font-black"
        aria-label="menos"
      >
        −
      </button>
      <span className="font-display w-8 text-center text-3xl">{value}</span>
      <button
        type="button"
        onClick={() => onChange(Math.min(9, value + 1))}
        className="btn-cartoon h-10 w-10 rounded-full bg-cream text-xl font-black"
        aria-label="más"
      >
        +
      </button>
    </div>
  );
}

// Which concrete match each stage's exact-score tiebreaker refers to. Cuartos
// has known teams (ordered inputs, labeled); semis/final teams are still TBD
// (order doesn't matter).
const QF4_MATCH = QUARTERFINALS.find((m) => m.id === "qf4")!;
const TB_MATCH: Record<
  Stage,
  { title: string; detail: string; ordered: boolean; homeLabel?: string; awayLabel?: string }
> = {
  cuartos: {
    title: `${MUNDIAL_TEAMS[QF4_MATCH.home].flag} ${MUNDIAL_TEAMS[QF4_MATCH.home].name} vs ${MUNDIAL_TEAMS[QF4_MATCH.away].flag} ${MUNDIAL_TEAMS[QF4_MATCH.away].name}`,
    detail: `El 4º partido de cuartos de final (${MUNDIAL_TEAMS[QF4_MATCH.home].name} vs ${MUNDIAL_TEAMS[QF4_MATCH.away].name}).`,
    ordered: true,
    homeLabel: `${MUNDIAL_TEAMS[QF4_MATCH.home].flag} ${MUNDIAL_TEAMS[QF4_MATCH.home].name}`,
    awayLabel: `${MUNDIAL_TEAMS[QF4_MATCH.away].flag} ${MUNDIAL_TEAMS[QF4_MATCH.away].name}`,
  },
  semis: {
    title: "La Semifinal 2",
    detail:
      "La semifinal entre el ganador de Noruega-Inglaterra y el ganador de Argentina-Suiza.",
    ordered: false,
  },
  final: {
    title: "La Gran Final",
    detail: "El partido que define al campeón del Mundial.",
    ordered: false,
  },
};

// Exact-score tiebreaker for a stage: predict the score of a specific match.
function ScorePicker({
  stage,
  score,
  onChange,
}: {
  stage: Stage;
  score: { home: number; away: number };
  onChange: (s: { home: number; away: number }) => void;
}) {
  const info = TB_MATCH[stage];
  return (
    <div className="cartoon-border rounded-2xl bg-blue/10 p-5">
      <p className="text-xs font-black uppercase tracking-wide opacity-60">
        Desempate de esta fase
      </p>
      <p className="font-display mt-1 text-xl">Marcador de {info.title}</p>
      <p className="mt-1 text-sm opacity-70">
        {info.detail} Si empatas esta fase con alguien más, gana quien quede
        más cerca (o exacto) de este marcador.
      </p>
      <div className="mt-4 flex items-end justify-center gap-4">
        <div className="text-center">
          {info.homeLabel ? (
            <p className="mb-1 text-xs font-black uppercase">{info.homeLabel}</p>
          ) : null}
          <Stepper value={score.home} onChange={(v) => onChange({ ...score, home: v })} />
        </div>
        <span className="font-display pb-2 text-3xl">–</span>
        <div className="text-center">
          {info.awayLabel ? (
            <p className="mb-1 text-xs font-black uppercase">{info.awayLabel}</p>
          ) : null}
          <Stepper value={score.away} onChange={(v) => onChange({ ...score, away: v })} />
        </div>
      </div>
      {!info.ordered ? (
        <p className="mt-3 text-center text-xs opacity-60">
          El orden no importa: solo predice cómo quedará el marcador.
        </p>
      ) : null}
    </div>
  );
}

function PasoCuartos({
  draft,
  setDraft,
}: {
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft>>;
}) {
  return (
    <section className="space-y-6">
      <h2 className="font-display text-3xl">¿Quién gana cada cuarto de final?</h2>
      <p className="leading-relaxed">
        Ganas el premio de cuartos si aciertas los <strong>4 equipos</strong> que
        avanzan a semifinales.
      </p>
      {QUARTERFINALS.map((match, i) => (
        <div key={match.id} className="cartoon-border cartoon-shadow rounded-2xl bg-cream p-5">
          <p className="text-sm font-black uppercase tracking-wide opacity-70">
            Partido {i + 1} · {match.venue} · {match.kickoffLabel}
          </p>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[match.home, match.away].map((teamId) => (
              <TeamButton
                key={teamId}
                teamId={teamId}
                selected={draft.qf[match.id] === teamId}
                onSelect={() =>
                  setDraft((d) => ({ ...d, qf: { ...d.qf, [match.id]: teamId } }))
                }
              />
            ))}
          </div>
        </div>
      ))}
      <ScorePicker
        stage="cuartos"
        score={draft.tbCuartos}
        onChange={(s) => setDraft((d) => ({ ...d, tbCuartos: s }))}
      />
    </section>
  );
}

function PasoSemis({
  draft,
  setDraft,
}: {
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft>>;
}) {
  return (
    <section className="space-y-6">
      <h2 className="font-display text-3xl">¿Qué equipos llegan a la final?</h2>
      <p className="leading-relaxed">
        Ganas el premio de semifinales si aciertas a los{" "}
        <strong>2 finalistas</strong>. Elige uno de cada lado del cuadro.
      </p>
      {SEMIFINALS.map((slot) => (
        <div key={slot.id} className="cartoon-border cartoon-shadow rounded-2xl bg-cream p-5">
          <p className="font-display text-xl">{slot.label}</p>
          <p className="mt-1 text-sm opacity-70">{slot.detail}</p>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {slot.candidates.map((teamId) => (
              <TeamButton
                key={teamId}
                teamId={teamId}
                selected={draft[slot.id] === teamId}
                onSelect={() => setDraft((d) => ({ ...d, [slot.id]: teamId }))}
              />
            ))}
          </div>
        </div>
      ))}
      <ScorePicker
        stage="semis"
        score={draft.tbSemis}
        onChange={(s) => setDraft((d) => ({ ...d, tbSemis: s }))}
      />
    </section>
  );
}

function PasoCampeon({
  draft,
  setDraft,
  answers,
}: {
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft>>;
  answers: MundialAnswers | null;
}) {
  return (
    <section className="space-y-6">
      <h2 className="font-display text-3xl">¿Quién será campeón del Mundial? 🏆</h2>
      <p className="leading-relaxed">
        Ganas el premio final si aciertas al campeón. Si varios lo aciertan,
        gana quien quede más cerca en el marcador de la final.
      </p>
      <div className="cartoon-border cartoon-shadow rounded-2xl bg-cream p-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {ALIVE_TEAMS.map((teamId) => (
            <TeamButton
              key={teamId}
              teamId={teamId}
              selected={draft.champion === teamId}
              onSelect={() => setDraft((d) => ({ ...d, champion: teamId }))}
            />
          ))}
        </div>
      </div>
      <ScorePicker
        stage="final"
        score={draft.tbFinal}
        onChange={(s) => setDraft((d) => ({ ...d, tbFinal: s }))}
      />

      <div className="cartoon-border cartoon-shadow rounded-2xl bg-cream p-5">
        <p className="font-display text-xl">¿Cómo terminará la final?</p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {FINAL_ENDINGS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setDraft((d) => ({ ...d, finalEnding: opt.id }))}
              aria-pressed={draft.finalEnding === opt.id}
              className={`btn-cartoon rounded-xl px-4 py-3 font-bold ${
                draft.finalEnding === opt.id ? "bg-yellow" : "bg-cream"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="cartoon-border cartoon-shadow rounded-2xl bg-cream p-5">
        <p className="font-display text-xl">¿Quién será el goleador del torneo?</p>
        <p className="mt-1 text-sm opacity-70">El máximo anotador del Mundial (Bota de Oro).</p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {TOP_SCORER_CANDIDATES.map((p) => (
            <PlayerButton
              key={p.id}
              teamId={p.team}
              name={p.name}
              selected={draft.topScorer === p.id}
              onSelect={() => setDraft((d) => ({ ...d, topScorer: p.id }))}
            />
          ))}
          <button
            type="button"
            onClick={() => setDraft((d) => ({ ...d, topScorer: "otro" }))}
            aria-pressed={draft.topScorer === "otro"}
            className={`btn-cartoon rounded-xl px-4 py-3 font-bold ${
              draft.topScorer === "otro" ? "bg-yellow" : "bg-cream"
            }`}
          >
            🌍 Otro jugador
          </button>
        </div>
      </div>

      <div className="cartoon-border cartoon-shadow rounded-2xl bg-cream p-5">
        <p className="font-display text-xl">¿Quién será la estrella de la final?</p>
        <p className="mt-1 text-sm opacity-70">
          Una figura por selección; elige al jugador que crees que brillará en la final.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {FINAL_STARS.map((p) => (
            <PlayerButton
              key={p.id}
              teamId={p.team}
              name={p.name}
              selected={draft.finalStar === p.id}
              onSelect={() => setDraft((d) => ({ ...d, finalStar: p.id }))}
            />
          ))}
        </div>
      </div>

      {answers ? <ResumenAnswers answers={answers} title="Revisa antes de enviar" /> : null}
    </section>
  );
}

function ResumenAnswers({ answers, title }: { answers: MundialAnswers; title: string }) {
  const t = (id: string) => {
    const team = teamById(id);
    return team ? `${team.flag} ${team.name}` : id;
  };
  const tb = answers.tiebreakers;
  const rows: [string, string][] = [
    ["Cuartos", [answers.qf1, answers.qf2, answers.qf3, answers.qf4].map(t).join(" · ")],
    ["Finalistas", `${t(answers.sf1)} y ${t(answers.sf2)}`],
    ["Campeón", t(answers.champion)],
    ["Marcador Argentina-Suiza", `${tb.cuartos.home} – ${tb.cuartos.away}`],
    ["Marcador Semifinal 2", `${tb.semis.home} – ${tb.semis.away}`],
    ["Marcador de la final", `${tb.final.home} – ${tb.final.away}`],
    ["¿Cómo termina la final?", finalEndingLabel(answers.finalEnding)],
    ["Goleador del torneo", topScorerLabel(answers.topScorer)],
    ["Estrella de la final", finalStarLabel(answers.finalStar)],
  ];
  return (
    <div className="cartoon-border rounded-2xl bg-yellow/20 p-5">
      <p className="font-display text-xl">{title}</p>
      <dl className="mt-3 space-y-1 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex flex-wrap justify-between gap-2">
            <dt className="font-black uppercase tracking-wide opacity-70">{label}</dt>
            <dd className="font-bold">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-xs font-bold opacity-70">
        Después de enviar ya no se puede editar.
      </p>
    </div>
  );
}

function Confirmacion({
  draft,
  answers,
  eligible,
}: {
  draft: Draft;
  answers: MundialAnswers;
  eligible: Stage[];
}) {
  return (
    <div className="cartoon-border cartoon-shadow-lg rounded-2xl bg-cream p-8 text-center">
      <Image
        src={quinielaAsset("mascot-celebrating")}
        alt=""
        width={280}
        height={280}
        aria-hidden
        className="mx-auto h-40 w-auto"
      />
      <h1 className="font-display mt-2 text-4xl">¡Tu quiniela quedó registrada!</h1>
      <p className="mx-auto mt-4 max-w-md leading-relaxed">
        Gracias por apoyar esta causa, {draft.fullName.split(" ")[0]}. Te
        enviamos una copia de tus respuestas a <strong>{draft.email}</strong> y
        publicaremos los resultados por etapa conforme avance el Mundial.
      </p>
      <p className="cartoon-border mx-auto mt-6 inline-block rounded-full bg-green px-5 py-2 font-bold">
        Compites en: {eligible.map((s) => STAGE_LABELS[s]).join(", ")}
      </p>
      <div className="mx-auto mt-8 max-w-md text-left">
        <ResumenAnswers answers={answers} title="Tus predicciones" />
      </div>
      <Link
        href="/"
        className="btn-cartoon mt-8 inline-flex h-12 items-center rounded-full bg-red px-6 font-bold text-cream"
      >
        Volver a supergana.fun →
      </Link>
    </div>
  );
}

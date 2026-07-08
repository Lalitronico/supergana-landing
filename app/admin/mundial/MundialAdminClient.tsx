"use client";

import { useCallback, useEffect, useState } from "react";
import {
  eligibleStages,
  formatUsd,
  STAGE_LABELS,
  STAGES,
  type Stage,
  type PrizePool,
} from "@/lib/mundial/config";
import { QUARTERFINALS, ALIVE_TEAMS, MUNDIAL_TEAMS, teamById } from "@/lib/mundial/teams";
import {
  FINAL_ENDINGS,
  FINAL_STARS,
  TOP_SCORER_CANDIDATES,
} from "@/lib/mundial/players";
import type {
  MundialEntryRow,
  MundialResultsRow,
  MundialTicketRow,
} from "@/lib/mundial/schema";

interface WinnersRow {
  stage: Stage;
  payload: {
    winners: { fullName: string; submittedAt: string; distance: number }[];
    count: number;
    hitCount: number;
    eligibleCount: number;
    exact: boolean;
    prizePerWinner: number;
    rolloverUsd: number;
    rollsToFinal: boolean;
  };
  prize_usd: number;
  published: boolean;
}

interface AdminData {
  tickets: MundialTicketRow[];
  entries: MundialEntryRow[];
  results: (MundialResultsRow & { updated_at: string }) | null;
  winners: WinnersRow[];
  pool: PrizePool;
}

const TABS = ["Participantes", "Resultados", "Ganadores", "Boletos"] as const;

export function MundialAdminClient() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [data, setData] = useState<AdminData | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]>("Participantes");
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const res = await fetch("/api/mundial/admin/data");
    if (res.status === 401) {
      setAuthed(false);
      return;
    }
    if (!res.ok) {
      setError("No se pudieron cargar los datos.");
      return;
    }
    setData(await res.json());
    setAuthed(true);
    setError(null);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b-[3px] border-ink bg-ink">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <p className="font-display text-xl text-cream">
            Admin · Quiniela Mundial <span className="text-yellow">x Rotary</span>
          </p>
          {authed ? (
            <button
              onClick={loadData}
              className="rounded-full border-2 border-cream px-4 py-1 text-sm font-bold text-cream hover:bg-cream hover:text-ink"
            >
              ↻ Actualizar
            </button>
          ) : null}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8">
        {error ? (
          <p className="cartoon-border mb-6 rounded-xl bg-red/10 p-4 font-bold text-red-deep">
            {error}
          </p>
        ) : null}

        {authed === false ? <Login onSuccess={loadData} /> : null}

        {authed && data ? (
          <>
            <PoolSummary pool={data.pool} entriesCount={data.entries.length} />
            <nav className="mt-8 flex flex-wrap gap-2">
              {TABS.map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`rounded-full border-[3px] border-ink px-5 py-2 font-bold ${
                    tab === t ? "bg-yellow" : "bg-cream"
                  }`}
                >
                  {t}
                </button>
              ))}
            </nav>
            <div className="mt-6">
              {tab === "Participantes" ? <Participantes data={data} /> : null}
              {tab === "Resultados" ? (
                <Resultados initial={data.results} onSaved={loadData} />
              ) : null}
              {tab === "Ganadores" ? (
                <Ganadores winners={data.winners} onChanged={loadData} />
              ) : null}
              {tab === "Boletos" ? <BoletosManuales onCreated={loadData} /> : null}
            </div>
          </>
        ) : null}

        {authed === null ? <p className="font-bold">Cargando…</p> : null}
      </main>
    </div>
  );
}

function Login({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/mundial/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setMessage(data.error ?? "Contraseña incorrecta");
      return;
    }
    onSuccess();
  };

  return (
    <form
      onSubmit={submit}
      className="cartoon-border cartoon-shadow-lg mx-auto mt-16 max-w-sm rounded-2xl bg-cream p-8"
    >
      <h1 className="font-display text-2xl">Acceso administrador</h1>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Contraseña"
        className="mt-4 w-full rounded-xl border-[3px] border-ink bg-cream px-4 py-3 outline-none"
        autoFocus
      />
      {message ? <p className="mt-2 text-sm font-bold text-red-deep">{message}</p> : null}
      <button
        type="submit"
        disabled={busy || !password}
        className="btn-cartoon mt-4 h-12 w-full rounded-full bg-red font-bold text-cream disabled:opacity-40"
      >
        {busy ? "Verificando…" : "Entrar"}
      </button>
    </form>
  );
}

function PoolSummary({ pool, entriesCount }: { pool: PrizePool; entriesCount: number }) {
  const cards = [
    ["Boletos pagados", String(pool.ticketsSold)],
    ["Quinielas enviadas", String(entriesCount)],
    ["Recaudado", formatUsd(pool.totalUsd)],
    ["Donativo (75%)", formatUsd(pool.donationUsd)],
    ["Premios (25%)", formatUsd(pool.prizesTotalUsd)],
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {cards.map(([label, value]) => (
        <div key={label} className="cartoon-border rounded-xl bg-cream p-4">
          <p className="text-xs font-bold uppercase tracking-wide opacity-70">{label}</p>
          <p className="font-display text-2xl">{value}</p>
        </div>
      ))}
    </div>
  );
}

function Participantes({ data }: { data: AdminData }) {
  const entryByTicket = new Map(data.entries.map((e) => [e.ticket_id, e]));
  return (
    <section>
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl">Boletos y quinielas</h2>
        <a
          href="/api/mundial/admin/export"
          className="btn-cartoon rounded-full bg-green px-5 py-2 font-bold"
        >
          Exportar CSV ↓
        </a>
      </div>
      <div className="cartoon-border mt-4 overflow-x-auto rounded-xl bg-cream">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead>
            <tr className="border-b-[3px] border-ink font-black uppercase tracking-wide">
              <th className="p-3">Pago</th>
              <th className="p-3">Origen</th>
              <th className="p-3">Participante</th>
              <th className="p-3">Contacto</th>
              <th className="p-3">Quiniela</th>
              <th className="p-3">Etapas</th>
              <th className="p-3">Predicciones</th>
            </tr>
          </thead>
          <tbody>
            {data.tickets.map((t) => {
              const e = entryByTicket.get(t.id);
              const a = e?.answers;
              return (
                <tr key={t.id} className="border-b border-ink/15 align-top">
                  <td className="p-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-black ${
                        t.status === "paid" ? "bg-green" : "bg-red text-cream"
                      }`}
                    >
                      {t.status === "paid" ? `$${Number(t.amount_usd)}` : t.status}
                    </span>
                    <p className="mt-1 text-xs opacity-60">
                      {new Date(t.created_at).toLocaleString("es-MX")}
                    </p>
                  </td>
                  <td className="p-3">
                    {t.source}
                    {t.note ? <p className="text-xs opacity-60">{t.note}</p> : null}
                  </td>
                  <td className="p-3 font-bold">{e?.full_name ?? "— sin llenar —"}</td>
                  <td className="p-3">
                    {e?.email ?? t.email ?? ""}
                    {e?.phone ? <p className="text-xs opacity-60">{e.phone}</p> : null}
                  </td>
                  <td className="p-3">
                    {e ? new Date(e.created_at).toLocaleString("es-MX") : "pendiente"}
                  </td>
                  <td className="p-3">
                    {e
                      ? eligibleStages(new Date(e.created_at))
                          .map((s) => STAGE_LABELS[s])
                          .join(", ")
                      : ""}
                  </td>
                  <td className="p-3 text-xs">
                    {a
                      ? `QF: ${[a.qf1, a.qf2, a.qf3, a.qf4]
                          .map((id) => teamById(id)?.flag ?? id)
                          .join(" ")} · Finalistas: ${teamById(a.sf1)?.flag}${
                          teamById(a.sf2)?.flag
                        } · 🏆 ${teamById(a.champion)?.name}`
                      : ""}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {data.tickets.length === 0 ? (
          <p className="p-6 text-center font-bold opacity-60">Aún no hay boletos.</p>
        ) : null}
      </div>
    </section>
  );
}

function Resultados({
  initial,
  onSaved,
}: {
  initial: (MundialResultsRow & { updated_at: string }) | null;
  onSaved: () => void;
}) {
  const [qf, setQf] = useState<Partial<Record<"qf1" | "qf2" | "qf3" | "qf4", string>>>(
    initial?.qf_winners ?? {},
  );
  const [finalists, setFinalists] = useState<string[]>(initial?.finalists ?? []);
  const [champion, setChampion] = useState<string | null>(initial?.champion ?? null);
  const [scores, setScores] = useState<Record<Stage, { home: string; away: string }>>({
    cuartos: {
      home: initial?.tiebreaker_scores?.cuartos?.home?.toString() ?? "",
      away: initial?.tiebreaker_scores?.cuartos?.away?.toString() ?? "",
    },
    semis: {
      home: initial?.tiebreaker_scores?.semis?.home?.toString() ?? "",
      away: initial?.tiebreaker_scores?.semis?.away?.toString() ?? "",
    },
    final: {
      home: initial?.tiebreaker_scores?.final?.home?.toString() ?? "",
      away: initial?.tiebreaker_scores?.final?.away?.toString() ?? "",
    },
  });
  const [topScorer, setTopScorer] = useState<string>(initial?.final_extras?.topScorer ?? "");
  const [finalStar, setFinalStar] = useState<string>(initial?.final_extras?.star ?? "");
  const [ending, setEnding] = useState<string>(initial?.final_extras?.ending ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const toggleFinalist = (id: string) =>
    setFinalists((f) =>
      f.includes(id) ? f.filter((x) => x !== id) : f.length < 2 ? [...f, id] : f,
    );

  const save = async () => {
    setBusy(true);
    setMessage(null);
    // Only include a stage's score once both numbers are filled.
    const tiebreaker_scores: Record<string, { home: number; away: number }> = {};
    (["cuartos", "semis", "final"] as Stage[]).forEach((s) => {
      const { home, away } = scores[s];
      if (home !== "" && away !== "") {
        tiebreaker_scores[s] = { home: Number(home), away: Number(away) };
      }
    });
    const final_extras: Record<string, string> = {};
    if (topScorer) final_extras.topScorer = topScorer;
    if (finalStar) final_extras.star = finalStar;
    if (ending) final_extras.ending = ending;
    const res = await fetch("/api/mundial/admin/results", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        qf_winners: qf,
        finalists,
        champion,
        tiebreaker_scores,
        final_extras,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setMessage(data.error ?? "Error al guardar");
      return;
    }
    setMessage("Resultados guardados ✓");
    onSaved();
  };

  const chip = (id: string, selected: boolean, onClick: () => void) => {
    const team = MUNDIAL_TEAMS[id as keyof typeof MUNDIAL_TEAMS];
    return (
      <button
        key={id}
        type="button"
        onClick={onClick}
        className={`rounded-full border-[3px] border-ink px-3 py-1 text-sm font-bold ${
          selected ? "bg-yellow" : "bg-cream"
        }`}
      >
        {team.flag} {team.name}
      </button>
    );
  };

  return (
    <section className="space-y-6">
      <h2 className="font-display text-2xl">Resultados reales</h2>
      <p className="text-sm opacity-70">
        Captura conforme se juegue cada partido. Guardar no calcula ganadores:
        eso se hace en la pestaña Ganadores.
      </p>

      {QUARTERFINALS.map((match, i) => (
        <div key={match.id} className="cartoon-border rounded-xl bg-cream p-4">
          <p className="text-sm font-black uppercase">Ganador cuartos {i + 1}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {[match.home, match.away].map((id) =>
              chip(id, qf[match.id] === id, () =>
                setQf((prev) => ({ ...prev, [match.id]: id })),
              ),
            )}
          </div>
        </div>
      ))}

      <div className="cartoon-border rounded-xl bg-cream p-4">
        <p className="text-sm font-black uppercase">Finalistas (elige 2)</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {ALIVE_TEAMS.map((id) => chip(id, finalists.includes(id), () => toggleFinalist(id)))}
        </div>
      </div>

      <div className="cartoon-border rounded-xl bg-cream p-4">
        <p className="text-sm font-black uppercase">Campeón</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {ALIVE_TEAMS.map((id) => chip(id, champion === id, () => setChampion(id)))}
        </div>
      </div>

      <div className="cartoon-border rounded-xl bg-cream p-4">
        <p className="text-sm font-black uppercase">Marcadores de desempate</p>
        <p className="mt-1 text-xs opacity-60">
          Marcador real del partido clave de cada fase (se compara sin importar
          el orden). Necesario para calcular al ganador de esa fase.
        </p>
        <div className="mt-3 grid gap-3">
          {(
            [
              ["cuartos", "Argentina 🇦🇷 – Suiza 🇨🇭 (4º de cuartos)"],
              ["semis", "Semifinal 2 (lado Arg-Sui) — orden libre"],
              ["final", "La final — orden libre"],
            ] as [Stage, string][]
          ).map(([s, label]) => (
            <div key={s} className="flex flex-wrap items-center gap-3">
              <span className="w-64 text-sm font-bold">{label}</span>
              <input
                type="number"
                min={0}
                max={9}
                value={scores[s].home}
                onChange={(e) =>
                  setScores((prev) => ({ ...prev, [s]: { ...prev[s], home: e.target.value } }))
                }
                className="w-16 rounded-xl border-[3px] border-ink bg-cream px-3 py-2"
              />
              <span className="font-display text-xl">–</span>
              <input
                type="number"
                min={0}
                max={9}
                value={scores[s].away}
                onChange={(e) =>
                  setScores((prev) => ({ ...prev, [s]: { ...prev[s], away: e.target.value } }))
                }
                className="w-16 rounded-xl border-[3px] border-ink bg-cream px-3 py-2"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="cartoon-border rounded-xl bg-cream p-4">
        <p className="text-sm font-black uppercase">Preguntas extra de la final</p>
        <p className="mt-1 text-xs opacity-60">
          Desempates adicionales del premio final (tras el marcador). Captúralos
          una vez jugada la final.
        </p>
        <div className="mt-3 grid gap-4">
          <div>
            <span className="text-sm font-bold">¿Cómo terminó la final?</span>
            <div className="mt-1 flex flex-wrap gap-2">
              {FINAL_ENDINGS.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setEnding(ending === o.id ? "" : o.id)}
                  className={`rounded-full border-[3px] border-ink px-3 py-1 text-sm font-bold ${
                    ending === o.id ? "bg-yellow" : "bg-cream"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <label className="text-sm font-bold">
            Goleador del torneo
            <select
              value={topScorer}
              onChange={(e) => setTopScorer(e.target.value)}
              className="mt-1 block w-full max-w-xs rounded-xl border-[3px] border-ink bg-cream px-3 py-2"
            >
              <option value="">— sin capturar —</option>
              {TOP_SCORER_CANDIDATES.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
              <option value="otro">Otro jugador</option>
            </select>
          </label>
          <label className="text-sm font-bold">
            Estrella de la final
            <select
              value={finalStar}
              onChange={(e) => setFinalStar(e.target.value)}
              className="mt-1 block w-full max-w-xs rounded-xl border-[3px] border-ink bg-cream px-3 py-2"
            >
              <option value="">— sin capturar —</option>
              {FINAL_STARS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({MUNDIAL_TEAMS[p.team].name})
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {message ? <p className="font-bold">{message}</p> : null}
      <button
        onClick={save}
        disabled={busy}
        className="btn-cartoon h-12 rounded-full bg-green px-6 font-bold disabled:opacity-40"
      >
        {busy ? "Guardando…" : "Guardar resultados"}
      </button>
    </section>
  );
}

function Ganadores({ winners, onChanged }: { winners: WinnersRow[]; onChanged: () => void }) {
  const [busy, setBusy] = useState<Stage | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const winnersByStage = new Map(winners.map((w) => [w.stage, w]));

  const compute = async (stage: Stage) => {
    setBusy(stage);
    setMessage(null);
    const res = await fetch("/api/mundial/admin/winners", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "compute", stage }),
    });
    setBusy(null);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(data.error ?? "Error al calcular");
      return;
    }
    onChanged();
  };

  const publish = async (stage: Stage, published: boolean) => {
    setBusy(stage);
    const res = await fetch("/api/mundial/admin/winners", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "publish", stage, published }),
    });
    setBusy(null);
    if (!res.ok) {
      setMessage("Error al publicar");
      return;
    }
    onChanged();
  };

  return (
    <section className="space-y-6">
      <h2 className="font-display text-2xl">Ganadores por etapa</h2>
      <p className="text-sm opacity-70">
        Gana quien atinó la fase y quedó más cerca (o exacto) en el marcador del
        partido clave. Si empatan en el marcador, se divide entre ellos. Si
        nadie atina cuartos o semifinales, esa bolsa se acumula al premio de la
        final. Necesitas capturar los resultados Y el marcador de la fase antes
        de calcular.
      </p>
      {message ? <p className="font-bold text-red-deep">{message}</p> : null}
      {STAGES.map((stage) => {
        const saved = winnersByStage.get(stage);
        return (
          <div key={stage} className="cartoon-border rounded-xl bg-cream p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-display text-xl">
                {STAGE_LABELS[stage]}
                {saved ? (
                  <span className="ml-2 text-sm opacity-60">
                    bolsa {formatUsd(Number(saved.prize_usd))}
                    {saved.payload.rolloverUsd > 0
                      ? ` (incluye ${formatUsd(saved.payload.rolloverUsd)} acumulados)`
                      : ""}
                  </span>
                ) : null}
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={() => compute(stage)}
                  disabled={busy === stage}
                  className="btn-cartoon rounded-full bg-yellow px-4 py-2 text-sm font-bold disabled:opacity-40"
                >
                  {busy === stage ? "…" : saved ? "Recalcular" : "Calcular"}
                </button>
                {saved ? (
                  <button
                    onClick={() => publish(stage, !saved.published)}
                    disabled={busy === stage}
                    className={`btn-cartoon rounded-full px-4 py-2 text-sm font-bold disabled:opacity-40 ${
                      saved.published ? "bg-red text-cream" : "bg-green"
                    }`}
                  >
                    {saved.published ? "Despublicar" : "Publicar en la página"}
                  </button>
                ) : null}
              </div>
            </div>

            {saved ? (
              <div className="mt-3 text-sm">
                {saved.payload.count > 0 ? (
                  <p>
                    <strong>
                      {saved.payload.count}{" "}
                      {saved.payload.count === 1 ? "ganador" : "ganadores"}
                    </strong>{" "}
                    · {formatUsd(saved.payload.prizePerWinner)} c/u ·{" "}
                    {saved.payload.exact
                      ? "marcador exacto ✓"
                      : `más cercanos (distancia ${saved.payload.winners[0]?.distance})`}{" "}
                    · {saved.payload.hitCount} atinaron la fase de {saved.payload.eligibleCount} elegibles
                    {saved.published ? " · 🌐 publicado" : " · borrador"}
                  </p>
                ) : (
                  <p className="font-bold text-red-deep">
                    Nadie atinó esta etapa.
                    {saved.payload.rollsToFinal
                      ? " La bolsa se acumula al premio de la final."
                      : ""}
                    {saved.published ? " · 🌐 publicado" : " · borrador"}
                  </p>
                )}
                {saved.payload.winners.length > 0 ? (
                  <ul className="mt-2 grid gap-1">
                    {saved.payload.winners.map((w, i) => (
                      <li key={i} className="flex flex-wrap justify-between gap-2">
                        <span className="font-bold">🏆 {w.fullName}</span>
                        <span className="text-xs opacity-60">
                          enviada {new Date(w.submittedAt).toLocaleString("es-MX")}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : (
              <p className="mt-3 text-sm opacity-60">Aún sin calcular.</p>
            )}
          </div>
        );
      })}
    </section>
  );
}

function BoletosManuales({ onCreated }: { onCreated: () => void }) {
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [sendEmail, setSendEmail] = useState(true);
  const [busy, setBusy] = useState(false);
  const [links, setLinks] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const create = async () => {
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/mundial/admin/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: email.trim() || undefined,
        note: note.trim() || undefined,
        sendEmail: sendEmail && Boolean(email.trim()),
      }),
    });
    setBusy(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(data.error ?? "Error al crear el boleto");
      return;
    }
    setLinks((l) => [data.link, ...l]);
    setEmail("");
    setNote("");
    onCreated();
  };

  return (
    <section className="max-w-xl space-y-4">
      <h2 className="font-display text-2xl">Emitir boleto manual</h2>
      <p className="text-sm opacity-70">
        Para pagos recibidos fuera de Stripe (transferencia, efectivo). El
        enlace generado es el acceso único del participante: compártelo solo
        cuando confirmes el pago.
      </p>
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Correo del participante (opcional)"
        className="w-full rounded-xl border-[3px] border-ink bg-cream px-4 py-3"
      />
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Nota interna: ej. 'transferencia 07-jul, recibo #12'"
        className="w-full rounded-xl border-[3px] border-ink bg-cream px-4 py-3"
      />
      <label className="flex items-center gap-2 text-sm font-bold">
        <input
          type="checkbox"
          checked={sendEmail}
          onChange={(e) => setSendEmail(e.target.checked)}
          className="h-4 w-4 accent-[#FF4757]"
        />
        Enviar el enlace por correo automáticamente
      </label>
      {message ? <p className="font-bold text-red-deep">{message}</p> : null}
      <button
        onClick={create}
        disabled={busy}
        className="btn-cartoon h-12 rounded-full bg-green px-6 font-bold disabled:opacity-40"
      >
        {busy ? "Creando…" : "Crear boleto"}
      </button>
      {links.length > 0 ? (
        <div className="cartoon-border rounded-xl bg-yellow/20 p-4 text-sm">
          <p className="font-black uppercase">Enlaces generados (cópialos ahora)</p>
          {links.map((link) => (
            <p key={link} className="mt-2 break-all font-mono">{link}</p>
          ))}
        </div>
      ) : null}
    </section>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { authThrottleKind, supabaseBrowser } from "@/lib/supabase/browser";
import { formatUsdCents, mechanicOf } from "@/lib/tickets/config";
import { canPayout, canReview } from "@/lib/tickets/roles";
import { PAYOUT_TRANSITIONS } from "@/lib/tickets/payouts";
import { formatMxPhone } from "@/lib/tickets/phone";
import type { CampaignMechanic, ProfileFields, RewardStatus } from "@/lib/tickets/config";
import type { EligibilityMode } from "@/lib/tickets/matching";
import type { AdminData, AdminProduct, QueueItem } from "./types";
import { ReviewPanel } from "./ReviewPanel";
import { StoreView } from "./StoreView";

type Gate = "loading" | "anon" | "forbidden" | "ready" | "error";
type View = "dash" | "queue" | "payouts" | "catalog" | "store";

const money = (cents: number) => formatUsdCents(cents, "en");

const RECEIPT_PILL: Record<string, string> = {
  received: "mute",
  in_review: "warn",
  approved: "ok",
  rejected: "bad",
  needs_new_image: "info",
};

const RECEIPT_LABEL: Record<string, string> = {
  received: "Recibido",
  in_review: "En revisión",
  approved: "Aprobado",
  rejected: "Rechazado",
  needs_new_image: "Imagen nueva",
};

const REWARD_PILL: Record<RewardStatus, string> = {
  reserved: "warn",
  queued: "info",
  sent: "ok",
  delivered: "ok",
  failed: "bad",
  canceled: "mute",
};

const REWARD_LABEL: Record<RewardStatus, string> = {
  reserved: "Fondo reservado",
  queued: "En cola",
  sent: "Enviada",
  delivered: "Entregada",
  failed: "Falló entrega",
  canceled: "Cancelada",
};

export function TicketsAdminClient({ slug }: { slug: string }) {
  const [gate, setGate] = useState<Gate>("loading");
  const [data, setData] = useState<AdminData | null>(null);
  const [view, setView] = useState<View>("dash");
  const [selected, setSelected] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; bad?: boolean } | null>(null);

  // Fetch and store are split so the mount effect only ever calls setState from
  // a promise callback, and a slow response cannot land on an unmounted console.
  const fetchSnapshot = useCallback(async (): Promise<{
    gate: Gate;
    data: AdminData | null;
  }> => {
    try {
      const res = await fetch(`/api/tickets/${slug}/admin/`, { cache: "no-store" });
      // 401 = no session, show the sign-in form. 403 = signed in but not on
      // this campaign's allowlist, which deserves a different message than a
      // login loop. The route distinguishes them so the browser doesn't have
      // to ask Supabase who it is just to pick a screen.
      if (res.status === 401) return { gate: "anon", data: null };
      if (res.status === 403) return { gate: "forbidden", data: null };
      if (!res.ok) return { gate: "error", data: null };
      return { gate: "ready", data: (await res.json()) as AdminData };
    } catch {
      return { gate: "error", data: null };
    }
  }, [slug]);

  const load = useCallback(async () => {
    const next = await fetchSnapshot();
    setGate(next.gate);
    setData(next.data);
  }, [fetchSnapshot]);

  /**
   * The background variant of `load`, and the difference is what it refuses to
   * do: a flaky tick must never replace a working console with the error
   * screen. Somebody mid-review losing the queue because one poll timed out is
   * a worse outcome than a snapshot that is thirty seconds stale.
   *
   * Auth changes still land. Being signed out is a fact, not a hiccup, and the
   * gate has to say so — now that it can be answered with a password.
   */
  const refresh = useCallback(async () => {
    const next = await fetchSnapshot();
    if (next.gate === "error") return;
    setGate(next.gate);
    setData(next.data);
  }, [fetchSnapshot]);

  useEffect(() => {
    let alive = true;
    fetchSnapshot().then((next) => {
      if (!alive) return;
      setGate(next.gate);
      setData(next.data);
    });
    return () => {
      alive = false;
    };
  }, [fetchSnapshot]);

  /**
   * The console notices on its own, the way the participant's panel does.
   *
   * Until now the only way to learn that a ticket had arrived was to press
   * "Actualizar", so a reviewer watching the queue watched a screen that had
   * decided to stop being true. Thirty seconds is slow enough to be free
   * against a queue this size and fast enough that nobody sits on a stale
   * count.
   *
   * Hidden tabs do not poll — a laptop with the console open in a background
   * window should not keep the snapshot warm for nobody — and returning to the
   * tab reads immediately rather than waiting out the interval.
   *
   * Safe under an open review: ReviewPanel is keyed by the receipt id and keeps
   * its own draft state, so a refresh under a half-filled form leaves the form
   * alone.
   */
  useEffect(() => {
    if (gate !== "ready") return;
    let inFlight = false;
    const tick = async () => {
      if (document.visibilityState !== "visible" || inFlight) return;
      inFlight = true;
      try {
        await refresh();
      } finally {
        inFlight = false;
      }
    };
    const timer = setInterval(tick, 30_000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [gate, refresh]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4200);
    return () => clearTimeout(timer);
  }, [toast]);

  if (gate === "loading") {
    return <div className="tka-gate"><p>Cargando…</p></div>;
  }
  if (gate === "anon") return <SignInGate onSignedIn={load} />;
  if (gate === "forbidden") return <ForbiddenGate slug={slug} />;
  if (gate === "error" || !data) {
    return (
      <div className="tka-gate">
        <div className="box">
          <h1>No pudimos cargar la consola</h1>
          <button className="tka-btn" onClick={() => void load()}>Reintentar</button>
        </div>
      </div>
    );
  }

  const { campaign, quota, summary, queue, decided, rewards, products, staff } = data;
  const reviewer = canReview(staff.role);
  const finance = canPayout(staff.role);
  const mechanic = mechanicOf(campaign.config);

  const notify = (text: string, bad?: boolean) => setToast({ text, bad });

  // Two mechanics, two consoles. A threshold campaign rations a fund and has no
  // store; an accumulation one has no fund to ration and spends its points in
  // the weekly Drop. Showing both to both is how an operator learns to ignore
  // half the screen.
  const NAV: { key: View; label: string; count?: number }[] = [
    { key: "dash", label: "Resumen" },
    { key: "queue", label: "Cola de revisión", count: queue.length },
    ...(mechanic === "accumulation"
      ? [{ key: "store" as View, label: "Tienda de Premios" }]
      : []),
    // A reward ledger with nothing in it and nothing that can enter it is
    // noise. It stays for threshold campaigns, and for any campaign that has
    // rewards on the books — turning the reward off must never hide money
    // already promised.
    ...(mechanic === "threshold" || rewards.length > 0
      ? [{ key: "payouts" as View, label: "Recompensas", count: rewards.length }]
      : []),
    { key: "catalog", label: "Catálogo y reglas" },
  ];

  return (
    <div className="tka">
      <aside className="tka-side">
        <div className="logo">
          <span className="dot" /> supergana{" "}
          <span style={{ fontWeight: 400, color: "#8E897C" }}>ops</span>
        </div>
        <div className="sec">Campaña</div>
        {NAV.map((item) => (
          <button
            key={item.key}
            aria-current={view === item.key}
            onClick={() => {
              setView(item.key);
              window.scrollTo(0, 0);
            }}
          >
            {item.label}
            {item.count !== undefined && <span className="count">{item.count}</span>}
          </button>
        ))}
        {/* The way out, next to the name of whoever is in. It used to exist only
            on the forbidden screen, which meant the sign-out button appeared
            exactly when you could no longer do anything and never when you
            could — so changing accounts meant clearing cookies by hand. */}
        <div className="foot">
          Sesión: {staff.email} · rol {staff.role}.
          <br />
          Toda decisión queda en bitácora con revisor, fecha y motivo.
          <button
            type="button"
            className="tka-btn ghost sm"
            style={{ marginTop: 10 }}
            onClick={async () => {
              await supabaseBrowser().auth.signOut();
              window.location.reload();
            }}
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      <div className="tka-main">
        <div className="tka-top">
          <div className="camp">
            🎟️ {campaign.name} — {campaign.orgName}
            <span className={`tka-badge ${campaign.status === "live" ? "live" : "draft"}`}>
              {campaign.status === "live" ? "● En vivo" : campaign.status}
            </span>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span className="tka-badge">
              Semana desde {new Date(quota.weekStart).toLocaleDateString("es-MX")}
            </span>
            <button className="tka-btn ghost sm" onClick={() => void load()}>
              Actualizar
            </button>
          </div>
        </div>

        <div className="tka-content">
          {view === "dash" && (
            <DashView
              quota={quota}
              summary={summary}
              config={campaign.config}
              mechanic={mechanic}
            />
          )}

          {view === "queue" && (
            <QueueView
              slug={slug}
              queue={queue}
              decided={decided}
              products={products}
              selected={selected}
              setSelected={setSelected}
              canReview={reviewer}
              mechanic={mechanic}
              rewardCents={campaign.config.rewardCents}
              minCents={campaign.config.minPurchaseCents}
              pointsPerDollar={campaign.config.pointsPerDollar}
              stores={campaign.config.stores}
              timezone={campaign.config.timezone}
              eligibility={campaign.config.eligibility}
              ocr={campaign.config.ocr}
              profileFields={campaign.config.profileFields}
              onDone={async (message, bad) => {
                notify(message, bad);
                if (!bad) {
                  setSelected(null);
                  await load();
                }
              }}
            />
          )}

          {view === "store" && <StoreView slug={slug} onNotify={notify} />}

          {view === "payouts" && (
            <PayoutsView
              slug={slug}
              rewards={rewards}
              quota={quota}
              canPayout={finance}
              onDone={async (message, bad) => {
                notify(message, bad);
                if (!bad) await load();
              }}
            />
          )}

          {view === "catalog" && (
            <CatalogView products={products} config={campaign.config} mechanic={mechanic} />
          )}
        </div>
      </div>

      {toast && <div className={`tka-toast ${toast.bad ? "bad" : ""}`} role="status">{toast.text}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Gates
// ---------------------------------------------------------------------------

const FIELD: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  fontSize: 12,
  fontWeight: 700,
};

/** The quiet way between modes. Not a button anybody should mistake for the CTA. */
const LINK: CSSProperties = {
  background: "none",
  border: 0,
  padding: 0,
  font: "inherit",
  fontSize: 11.5,
  fontWeight: 600,
  color: "#6B665B",
  textDecoration: "underline",
  cursor: "pointer",
  textAlign: "left",
};

type GateMode = "password" | "otp-email" | "otp-code";

/**
 * Getting into the console.
 *
 * Password first, code as the fallback — the same order the participant app
 * has always used (app/c/[campana]/entrar/page.tsx). This screen used to offer
 * the code and nothing else, which put the only entrance behind the one channel
 * this project cannot rely on: the built-in sender caps at two mails an hour
 * across the whole project, and the link inside them lands on the Site URL,
 * still pointing at localhost. An operator whose mail did not arrive had no
 * second door.
 *
 * "Ya tengo un código" exists because the previous shape had no field for a
 * code you already held. Codes get minted out of band — scripts/tickets-otp.mjs
 * prints one without sending mail — and the only button on the screen asked for
 * a fresh one, which invalidates the code in your hand. Two failure modes, one
 * missing link.
 *
 * The console still never mints accounts: `shouldCreateUser: false` on the OTP,
 * and no sign-up anywhere. A reviewer is added deliberately, by inserting a
 * campaign_admins row.
 */
function SignInGate({ onSignedIn }: { onSignedIn: () => void }) {
  const [mode, setMode] = useState<GateMode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  /** Set only when a code actually went out, so the code step can name where. */
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const address = () => email.trim().toLowerCase();
  const validEmail = () => /^\S+@\S+\.\S+$/.test(email.trim());

  const go = (next: GateMode) => {
    setMode(next);
    setError(null);
  };

  const signIn = async () => {
    if (!validEmail()) return setError("Revisa el correo.");
    setBusy(true);
    setError(null);
    const { error: authError } = await supabaseBrowser().auth.signInWithPassword({
      email: address(),
      password,
    });
    setBusy(false);
    // Wrong password and unknown account collapse into one message on purpose:
    // telling them apart confirms which addresses have console accounts.
    if (authError) return setError("Correo o contraseña incorrectos.");
    onSignedIn();
  };

  const send = async () => {
    if (!validEmail()) return setError("Revisa el correo.");
    setBusy(true);
    setError(null);
    const { error: authError } = await supabaseBrowser().auth.signInWithOtp({
      email: address(),
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(window.location.pathname)}`,
      },
    });
    setBusy(false);
    if (authError) {
      // Never surface gotrue's raw English string. The project-wide cap gets
      // its own copy because a reviewer locked out of the console during a
      // launch needs to know it is the budget, not their email — that is the
      // difference between calling the operator and retyping their address.
      const throttle = authThrottleKind(authError);
      if (throttle === "project") {
        console.error("[tickets admin] project email budget exhausted", authError.message);
      }
      return setError(
        throttle === "cooldown"
          ? "Pediste códigos muy seguido. Espera un minuto y vuelve a intentar."
          : throttle === "project"
            ? "El proyecto agotó su cuota de correos de esta hora. Es configuración, no tu cuenta: entra con tu contraseña o pide que revisen el SMTP."
            : "No pudimos enviar el código. Revisa el correo e intenta de nuevo.",
      );
    }
    setSentTo(address());
    setCode("");
    go("otp-code");
  };

  const verify = async () => {
    if (!validEmail()) return setError("Escribe el correo de tu cuenta.");
    const token = code.replace(/\D/g, "");
    // The OTP length is a project setting (6 to 10 digits), not a constant.
    // This project issues 8; hardcoding 6 would reject every real code.
    if (token.length < 6 || token.length > 10) return setError("El código está incompleto.");
    setBusy(true);
    setError(null);
    const { error: authError } = await supabaseBrowser().auth.verifyOtp({
      email: address(),
      token,
      type: "email",
    });
    setBusy(false);
    if (authError) return setError("Código incorrecto o vencido.");
    onSignedIn();
  };

  const emailField = (onEnter: () => void) => (
    <label style={FIELD}>
      Correo de tu cuenta
      <input
        type="email"
        autoComplete="username"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoFocus={mode !== "otp-code"}
        onKeyDown={(e) => e.key === "Enter" && onEnter()}
      />
    </label>
  );

  return (
    <div className="tka-gate">
      <div className="box">
        <h1>Consola de operación</h1>
        {error && <p style={{ color: "#E63946", fontSize: 13 }}>{error}</p>}

        {mode === "password" && (
          <>
            {emailField(() => void signIn())}
            <label style={FIELD}>
              Contraseña
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void signIn()}
              />
            </label>
            <button
              className="tka-btn"
              disabled={busy || !email || !password}
              onClick={() => void signIn()}
            >
              {busy ? "Entrando…" : "Entrar"}
            </button>
            <button type="button" style={LINK} onClick={() => go("otp-email")}>
              Entrar con un código por correo
            </button>
            <button type="button" style={LINK} onClick={() => go("otp-code")}>
              Ya tengo un código
            </button>
          </>
        )}

        {mode === "otp-email" && (
          <>
            {emailField(() => void send())}
            <button className="tka-btn" disabled={busy || !email} onClick={() => void send()}>
              {busy ? "Enviando…" : "Enviar código"}
            </button>
            <button type="button" style={LINK} onClick={() => go("password")}>
              Mejor con contraseña
            </button>
          </>
        )}

        {mode === "otp-code" && (
          <>
            {/* Named only when this screen sent it. Arriving here with a code
                minted elsewhere, the address is still unknown and verifyOtp
                needs it — so the field stays rather than a sentence that would
                have to guess. */}
            {sentTo ? (
              <p style={{ fontSize: 12, fontWeight: 700 }}>Código enviado a {sentTo}</p>
            ) : (
              emailField(() => void verify())
            )}
            <label style={FIELD}>
              Código
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={10}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && void verify()}
              />
            </label>
            <button
              className="tka-btn"
              disabled={busy || code.length < 6}
              onClick={() => void verify()}
            >
              {busy ? "Verificando…" : "Entrar"}
            </button>
            <button type="button" style={LINK} onClick={() => go("password")}>
              Mejor con contraseña
            </button>
          </>
        )}

        <p style={{ fontSize: 11.5, color: "#6B665B", lineHeight: 1.5 }}>
          El acceso se otorga por campaña. Si tu cuenta no está en la lista de
          revisores, pide que te agreguen antes de entrar.
        </p>
      </div>
    </div>
  );
}

function ForbiddenGate({ slug }: { slug: string }) {
  return (
    <div className="tka-gate">
      <div className="box">
        <h1>Sin acceso a esta campaña</h1>
        <p style={{ fontSize: 13, lineHeight: 1.5 }}>
          Tu sesión es válida, pero tu cuenta no está en la lista de operación de{" "}
          <b>{slug}</b>. Estar registrado no autoriza nada por sí solo.
        </p>
        <button
          className="tka-btn ghost"
          onClick={async () => {
            await supabaseBrowser().auth.signOut();
            window.location.reload();
          }}
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------

function DashView({
  quota,
  summary,
  config,
  mechanic,
}: {
  quota: AdminData["quota"];
  summary: AdminData["summary"];
  config: AdminData["campaign"]["config"];
  mechanic: CampaignMechanic;
}) {
  const pct = (n: number) => (quota.fundCents > 0 ? (n / quota.fundCents) * 100 : 0);
  const paid = quota.fundUsedCents - quota.fundReservedCents;
  // An accumulation campaign has no fund, no weekly quota and no slots — they
  // are zeroed on purpose (that IS how the reward layer is turned off). Four
  // cards reading $0 do not describe the campaign, they hide it.
  const rationed = mechanic === "threshold";

  const funnel: [string, number][] = [
    ["Participantes", summary.participants],
    ["Tickets enviados", summary.receipts],
    ["Aprobados", summary.approved],
    ["Opt-in marketing", summary.marketingOptIn],
  ];
  const top = Math.max(1, ...funnel.map(([, v]) => v));

  return (
    <>
      <div>
        <h2 className="tka-title">Resumen de campaña</h2>
        <div className="tka-sub">
          {rationed ? (
            <>
              Liberación escalonada: {quota.weeklyQuota} recompensas por semana · objetivo de
              servicio {config.reviewSlaHours} h · límite de {config.perHouseholdLimit} por
              hogar (apellido + ZIP)
            </>
          ) : (
            <>
              Acumulación: {config.pointsPerDollar} puntos por cada $1 elegible, sin recompensa
              por ticket · objetivo de servicio {config.reviewSlaHours} h · los puntos se
              canjean en el Drop semanal de la Tienda de Premios
            </>
          )}
        </div>
      </div>

      <div className="tka-grid4">
        {rationed && (
          <div className="tka-card tka-kpi">
            <div className="v">{money(quota.fundLeftCents)}</div>
            <div className="l">Fondo restante de {money(quota.fundCents)}</div>
            <div className="d">
              {money(paid)} entregado · {money(quota.fundReservedCents)} reservado
            </div>
          </div>
        )}
        <div className="tka-card tka-kpi">
          <div className="v">{summary.approved}</div>
          <div className="l">{rationed ? "Recompensas aprobadas" : "Tickets aprobados"}</div>
          <div className="d">de {summary.receipts} tickets recibidos</div>
        </div>
        {rationed && (
          <div className="tka-card tka-kpi">
            <div className="v">{quota.weeklyLeft}</div>
            <div className="l">Cupo restante esta semana</div>
            <div className="d">
              {quota.weeklyUsed} de {quota.weeklyQuota} usadas
            </div>
          </div>
        )}
        <div className="tka-card tka-kpi">
          <div className="v">
            {summary.medianReviewMinutes === null
              ? "—"
              : summary.medianReviewMinutes < 90
                ? `${summary.medianReviewMinutes} min`
                : `${Math.round(summary.medianReviewMinutes / 60)} h`}
          </div>
          <div className="l">Tiempo mediano de validación</div>
          <div className="d">objetivo de servicio: {config.reviewSlaHours} h</div>
        </div>
      </div>

      {rationed && (
      <div className="tka-card">
        <h3>Uso del fondo de premios</h3>
        <span className="tka-note">
          La reserva se toma en la misma transacción que aprueba el reclamo: el fondo no
          puede sobregirarse.
        </span>
        <div className="tka-fund">
          {paid > 0 && <div className="seg" style={{ width: `${pct(paid)}%`, background: "var(--a-ink)" }} />}
          {quota.fundReservedCents > 0 && (
            <div className="seg" style={{ width: `${pct(quota.fundReservedCents)}%`, background: "var(--a-blue)" }} />
          )}
          <div
            className="seg"
            style={{
              width: `${pct(quota.fundLeftCents)}%`,
              background:
                "repeating-linear-gradient(-45deg,var(--a-yellow) 0 10px,var(--a-yellow-deep) 10px 20px)",
            }}
          />
        </div>
        <div className="tka-legend">
          <span className="li"><span className="sw" style={{ background: "var(--a-ink)" }} />Entregado — {money(Math.max(0, paid))}</span>
          <span className="li"><span className="sw" style={{ background: "var(--a-blue)" }} />Reservado — {money(quota.fundReservedCents)}</span>
          <span className="li"><span className="sw" style={{ background: "var(--a-yellow)" }} />Disponible — {money(quota.fundLeftCents)}</span>
        </div>
        <p className="tka-note" style={{ marginTop: 10 }}>
          Slots de campaña: {quota.totalUsed} de {quota.totalSlots} usados ·{" "}
          {quota.totalLeft} disponibles.
        </p>
      </div>
      )}

      <div className="tka-grid2">
        <div className="tka-card">
          <h3>Embudo de participación</h3>
          <span className="tka-note">
            Desde el registro. Los escaneos de QR requieren instrumentar los enlaces con
            UTM: todavía no se miden aquí.
          </span>
          <div className="tka-funnel">
            {funnel.map(([label, value]) => (
              <div className="tka-fstep" key={label}>
                <span className="fl">{label}</span>
                <div className="track">
                  <div className="bar" style={{ width: `${(value / top) * 100}%` }} />
                </div>
                <span className="fv">{value}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="tka-card">
          <h3>Calidad de la compra</h3>
          <span className="tka-note">Sobre tickets aprobados</span>
          <dl className="tka-kv" style={{ marginTop: 14 }}>
            <dt>Gasto elegible promedio</dt>
            <dd>{summary.avgEligibleCents === null ? "—" : money(summary.avgEligibleCents)}</dd>
            {rationed ? (
              <>
                <dt>Compra mínima</dt>
                <dd>{money(config.minPurchaseCents)}</dd>
              </>
            ) : (
              <>
                <dt>Puntos por ticket promedio</dt>
                <dd>
                  {summary.avgEligibleCents === null
                    ? "—"
                    : Math.floor((summary.avgEligibleCents * config.pointsPerDollar) / 100)}
                </dd>
              </>
            )}
            <dt>Pendientes de revisar</dt>
            <dd>{summary.pending}</dd>
            <dt>Rechazados</dt>
            <dd>{summary.rejected}</dd>
            <dt>Esperando imagen nueva</dt>
            <dd>{summary.needsNewImage}</dd>
          </dl>
        </div>
      </div>
    </>
  );
}

function QueueView({
  slug,
  queue,
  decided,
  products,
  selected,
  setSelected,
  canReview: allowed,
  mechanic,
  rewardCents,
  minCents,
  pointsPerDollar,
  stores,
  timezone,
  eligibility,
  ocr,
  profileFields,
  onDone,
}: {
  slug: string;
  queue: QueueItem[];
  decided: QueueItem[];
  products: AdminProduct[];
  selected: string | null;
  setSelected: (id: string | null) => void;
  canReview: boolean;
  mechanic: CampaignMechanic;
  rewardCents: number;
  minCents: number;
  pointsPerDollar: number;
  /** Participating stores as they print, offered as suggestions to the reviewer. */
  stores: string[];
  /** The plaza, so the date box cannot offer a day that has not happened there. */
  timezone: string;
  /** Whether a line counts by exact SKU or by naming the brand. */
  eligibility: EligibilityMode;
  /** Whether this campaign reads receipts, and whether the reading pre-fills. */
  ocr: { enabled: boolean; autofill: boolean };
  /** Decides which identifying column is worth a place in the queue table. */
  profileFields: ProfileFields;
  onDone: (message: string, bad?: boolean) => void | Promise<void>;
}) {
  const all = useMemo(() => [...queue, ...decided], [queue, decided]);
  const current = all.find((item) => item.receipt.id === selected) ?? null;

  // One narrow column, spent on whatever this campaign actually collected. A
  // ZIP column full of dashes tells the reviewer nothing; on a campaign that
  // pays in phone top-ups, the number is the thing they scan the list for.
  const showsZip = profileFields.zip !== "off";
  const contactHeader = showsZip ? "ZIP" : profileFields.phone !== "off" ? "Celular" : "—";

  return (
    <>
      <div>
        <h2 className="tka-title">Cola de revisión</h2>
        <div className="tka-sub">
          {queue.length} tickets pendientes. Sin OCR en la v1: la captura de tienda, fecha,
          total y líneas se hace aquí, que es exactamente lo que la promesa de 48 h cubre.
        </div>
      </div>

      <div className="tka-card tka-scroll">
        <table>
          <thead>
            <tr>
              <th>Enviado</th>
              <th>Participante</th>
              <th>{contactHeader}</th>
              <th>Señales</th>
              <th>Elegible</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {all.length === 0 && (
              <tr>
                <td colSpan={6} style={{ color: "#6B665B" }}>
                  Todavía no hay tickets en esta campaña.
                </td>
              </tr>
            )}
            {all.map((item) => {
              const worst = item.flags.some((f) => f.level === "bad")
                ? "bad"
                : item.flags.some((f) => f.level === "warn")
                  ? "warn"
                  : "ok";
              return (
                <tr
                  key={item.receipt.id}
                  className={`clickable ${selected === item.receipt.id ? "sel" : ""}`}
                  onClick={() => setSelected(item.receipt.id)}
                >
                  <td className="tka-mono">
                    {new Date(item.receipt.submitted_at).toLocaleString("es-MX", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td>
                    <b>
                      {item.participant
                        ? `${item.participant.firstName} ${item.participant.lastName}`
                        : "—"}
                    </b>
                    <br />
                    <span style={{ fontSize: 11, color: "#6B665B" }}>
                      {item.participant?.email}
                    </span>
                  </td>
                  <td>
                    {showsZip
                      ? (item.participant?.zip ?? "—")
                      : item.participant?.phone
                        ? formatMxPhone(item.participant.phone)
                        : "—"}
                  </td>
                  <td>
                    <span className={`tka-pill ${worst === "ok" ? "ok" : worst === "warn" ? "warn" : "bad"}`}>
                      {worst === "ok" ? "Limpio" : worst === "warn" ? "Revisar" : "Alerta"}
                    </span>
                  </td>
                  <td>
                    {item.receipt.eligible_cents != null
                      ? money(item.receipt.eligible_cents)
                      : "—"}
                  </td>
                  <td>
                    <span className={`tka-pill ${RECEIPT_PILL[item.receipt.status]}`}>
                      {RECEIPT_LABEL[item.receipt.status]}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {current && (
        <ReviewPanel
          key={current.receipt.id}
          slug={slug}
          item={current}
          products={products}
          canReview={allowed}
          mechanic={mechanic}
          rewardCents={rewardCents}
          minCents={minCents}
          pointsPerDollar={pointsPerDollar}
          stores={stores}
          timezone={timezone}
          eligibility={eligibility}
          ocr={ocr}
          onDone={onDone}
        />
      )}
    </>
  );
}

function PayoutsView({
  slug,
  rewards,
  quota,
  canPayout: allowed,
  onDone,
}: {
  slug: string;
  rewards: AdminData["rewards"];
  quota: AdminData["quota"];
  canPayout: boolean;
  onDone: (message: string, bad?: boolean) => void | Promise<void>;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [refs, setRefs] = useState<Record<string, string>>({});

  const move = async (rewardId: string, status: RewardStatus) => {
    setBusy(rewardId);
    try {
      const res = await fetch(`/api/tickets/${slug}/admin/payout/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rewardId,
          status,
          providerRef: refs[rewardId]?.trim() || undefined,
        }),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        error?: string; now?: string; from?: string;
      };
      if (!res.ok) {
        // `already_moved` is the one an operator will actually meet: two people
        // working the same queue, one clicks first. Telling them the raw code
        // leaves them wondering whether to click again — which with manual
        // delivery is how the same gift card gets sent twice.
        const message =
          payload.error === "already_moved"
            ? `Otra persona ya movió esta recompensa${
                payload.now ? ` a "${REWARD_LABEL[payload.now as RewardStatus] ?? payload.now}"` : ""
              }. Refresca antes de volver a intentar.`
            : payload.error === "bad_transition"
              ? `Esa transición no es válida desde "${
                  REWARD_LABEL[payload.from as RewardStatus] ?? payload.from
                }".`
              : payload.error === "email_unverified"
                ? "El participante aún no verifica su correo. La recompensa se libera cuando lo confirme desde su panel — su pantalla ya se lo está pidiendo."
                : `No se pudo actualizar: ${payload.error ?? "error"}`;
        await onDone(message, true);
        return;
      }
      await onDone(`Recompensa marcada como ${REWARD_LABEL[status].toLowerCase()}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <div>
        <h2 className="tka-title">Recompensas</h2>
        <div className="tka-sub">
          Entrega manual en la v1: un operador envía la recompensa y registra aquí lo que
          hizo. El <span className="tka-mono">external_id</span> ya es la llave idempotente
          que usaría un proveedor automático, así que cambiar a Tremendous no toca este
          ledger. Cancelar es la única forma de devolver presupuesto al fondo.
        </div>
      </div>

      <div className="tka-grid4">
        <div className="tka-card tka-kpi">
          <div className="v">{rewards.filter((r) => r.status === "reserved").length}</div>
          <div className="l">Por enviar</div>
        </div>
        <div className="tka-card tka-kpi">
          <div className="v">
            {rewards.filter((r) => r.status === "sent" || r.status === "delivered").length}
          </div>
          <div className="l">Enviadas</div>
        </div>
        <div className="tka-card tka-kpi">
          <div className="v">{rewards.filter((r) => r.status === "failed").length}</div>
          <div className="l">Entregas fallidas</div>
        </div>
        <div className="tka-card tka-kpi">
          <div className="v">{money(quota.fundReservedCents)}</div>
          <div className="l">Comprometido sin entregar</div>
        </div>
      </div>

      <div className="tka-card tka-scroll">
        <table>
          <thead>
            <tr>
              <th>Creada</th>
              <th>Participante</th>
              <th>Monto</th>
              <th>external_id</th>
              <th>Referencia</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rewards.length === 0 && (
              <tr>
                <td colSpan={7} style={{ color: "#6B665B" }}>
                  Sin recompensas todavía.
                </td>
              </tr>
            )}
            {rewards.map((reward) => (
              <tr key={reward.id}>
                <td className="tka-mono">
                  {new Date(reward.created_at).toLocaleDateString("es-MX")}
                </td>
                <td>
                  <b>{reward.participantName ?? "—"}</b>
                  <br />
                  <span style={{ fontSize: 11, color: "#6B665B" }}>{reward.participantEmail}</span>
                </td>
                <td>{money(reward.amount_cents)}</td>
                <td className="tka-mono">{reward.external_id.slice(0, 8)}…</td>
                <td>
                  {reward.provider_ref ?? (
                    <input
                      type="text"
                      placeholder="folio del proveedor"
                      value={refs[reward.id] ?? ""}
                      onChange={(e) => setRefs((r) => ({ ...r, [reward.id]: e.target.value }))}
                      disabled={!allowed}
                      style={{ fontSize: 12, padding: "5px 8px" }}
                    />
                  )}
                </td>
                <td>
                  <span className={`tka-pill ${REWARD_PILL[reward.status]}`}>
                    {REWARD_LABEL[reward.status]}
                  </span>
                </td>
                <td>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {PAYOUT_TRANSITIONS[reward.status].map((next) => (
                      <button
                        key={next}
                        className={`tka-btn sm ${next === "canceled" || next === "failed" ? "bad" : next === "sent" || next === "delivered" ? "ok" : "ghost"}`}
                        disabled={!allowed || busy === reward.id}
                        onClick={() => void move(reward.id, next)}
                      >
                        {REWARD_LABEL[next]}
                      </button>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!allowed && (
          <p className="tka-note" style={{ marginTop: 12 }}>
            Tu rol puede ver el ledger pero no mover recompensas. Eso corresponde a
            finanzas, supervisión o administración.
          </p>
        )}
      </div>
    </>
  );
}

function CatalogView({
  products,
  config,
  mechanic,
}: {
  products: AdminProduct[];
  config: AdminData["campaign"]["config"];
  mechanic: CampaignMechanic;
}) {
  return (
    <>
      <div>
        <h2 className="tka-title">Catálogo y reglas</h2>
        <div className="tka-sub">
          Solo lectura en la v1: el catálogo y las reglas se editan por configuración de
          campaña. Cambiar una regla nunca afecta reclamos ya decididos — la bitácora
          guarda la captura del momento.
        </div>
      </div>

      <div className="tka-grid2">
        <div className="tka-card tka-scroll">
          <h3>Catálogo de productos</h3>
          <span className="tka-note">
            Las líneas impresas se comparan primero contra los alias y luego contra el
            nombre del producto, así que el catálogo funciona sin diccionario. Un alias
            sirve para enseñarle cómo escribe cada tienda lo mismo, y se cosecha de
            tickets reales de las tiendas participantes.
          </span>
          <table style={{ marginTop: 10 }}>
            <thead>
              <tr>
                <th>Marca</th>
                <th>Producto</th>
                <th>Alias en ticket</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id}>
                  <td><b>{product.brand}</b></td>
                  <td>
                    {product.name}
                    {product.size ? ` ${product.size}` : ""}
                  </td>
                  <td className="tka-mono">
                    {product.product_aliases.length === 0
                      ? "— sin alias —"
                      : product.product_aliases.map((a) => a.alias_text).join(" · ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="tka-card">
          <h3>Reglas vigentes</h3>
          <table style={{ marginTop: 10 }}>
            <tbody>
              {/* Los cinco gates de la recompensa valen 0 en una campaña de
                  acumulación: enseñarlos ahí es enseñar siete ceros y esconder
                  la única regla que sí decide algo, la tasa de puntos. */}
              {mechanic === "threshold" ? (
                <>
                  <tr><td>Compra mínima elegible</td><td style={{ textAlign: "right" }}><b>{money(config.minPurchaseCents)}</b></td></tr>
                  <tr><td>Recompensa</td><td style={{ textAlign: "right" }}><b>{money(config.rewardCents)}</b></td></tr>
                  <tr><td>Cupo semanal</td><td style={{ textAlign: "right" }}><b>{config.weeklyQuota}</b></td></tr>
                  <tr><td>Slots de campaña</td><td style={{ textAlign: "right" }}><b>{config.totalRewardSlots}</b></td></tr>
                  <tr><td>Por participante</td><td style={{ textAlign: "right" }}><b>{config.perParticipantLimit}</b></td></tr>
                  <tr><td>Por hogar (apellido + ZIP)</td><td style={{ textAlign: "right" }}><b>{config.perHouseholdLimit}</b></td></tr>
                  <tr><td>Fondo</td><td style={{ textAlign: "right" }}><b>{money(config.fundCents)}</b></td></tr>
                </>
              ) : (
                <>
                  <tr><td>Mecánica</td><td style={{ textAlign: "right" }}><b>Acumulación de puntos</b></td></tr>
                  <tr><td>Puntos por $1 elegible</td><td style={{ textAlign: "right" }}><b>{config.pointsPerDollar}</b></td></tr>
                  <tr><td>Recompensa por ticket</td><td style={{ textAlign: "right" }}><b>sin recompensa</b></td></tr>
                  <tr><td>Canje</td><td style={{ textAlign: "right" }}><b>Drop semanal de la tienda</b></td></tr>
                </>
              )}
              <tr><td>SLA de revisión</td><td style={{ textAlign: "right" }}><b>{config.reviewSlaHours} h</b></td></tr>
              <tr><td>Zona horaria (lunes)</td><td style={{ textAlign: "right" }}><b>{config.timezone}</b></td></tr>
              <tr><td>Estados elegibles</td><td style={{ textAlign: "right" }}><b>{config.eligibleStates.join(", ") || "sin restringir"}</b></td></tr>
              {/* The reviewer types the store by hand and the anti-duplicate lock
                  is (store + date + total), so an unlisted store is a real gap
                  and worth showing as one rather than leaving blank. */}
              <tr>
                <td>Tiendas participantes</td>
                <td style={{ textAlign: "right" }}>
                  <b>{config.stores.join(" · ") || "sin capturar"}</b>
                </td>
              </tr>
              <tr><td>Versión de reglas</td><td style={{ textAlign: "right" }}><b>{config.rulesVersion}</b></td></tr>
              <tr><td>Entrega</td><td style={{ textAlign: "right" }}><b>{config.payoutProvider}</b></td></tr>
            </tbody>
          </table>
          <p className="tka-note" style={{ marginTop: 12 }}>
            {mechanic === "accumulation"
              ? "Los premios y su inventario NO son configuración de campaña: viven en el Drop de la semana, que se cura desde la vista Tienda de Premios."
              : "El premio mayor arrastra AMOE y registro estatal, y no puede anunciarse antes de tener reglas oficiales."}
          </p>
        </div>
      </div>
    </>
  );
}

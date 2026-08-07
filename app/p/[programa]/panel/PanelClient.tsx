"use client";

import { useCallback, useEffect, useState } from "react";
import { authThrottleKind, supabaseBrowser } from "@/lib/supabase/browser";
import { WeekView } from "./WeekView";
import { DeskView } from "./DeskView";
import { AdjustView } from "./AdjustView";
import type { PanelData, PanelView } from "./types";

/**
 * The supervisor's console, and the branch's counter, in one screen.
 *
 * The gate is the tickets console's gate, deliberately: `/api/pickem/[slug]/panel/`
 * answers 401 without a session and 403 with a session that has no seat in
 * `campaign_admins`, and those two get different screens. Collapsing them means
 * somebody who signed in correctly gets shown a sign-in form again and
 * concludes the panel is broken.
 *
 * No polling. The tickets console refreshes every thirty seconds because a
 * review queue fills up while you look at it; nothing here does. The jornada
 * changes once a week and the counter changes when the cashier types a code —
 * a background tick would only risk replacing a half-typed form.
 */

type Gate = "loading" | "anon" | "forbidden" | "ready" | "error";

export function PanelClient({
  slug,
  initialView = "jornada",
}: {
  slug: string;
  initialView?: PanelView;
}) {
  const [gate, setGate] = useState<Gate>("loading");
  const [data, setData] = useState<PanelData | null>(null);
  const [view, setView] = useState<PanelView>(initialView);
  const [week, setWeek] = useState<number | null>(null);
  const [toast, setToast] = useState<{ text: string; bad?: boolean } | null>(null);

  const fetchSnapshot = useCallback(
    async (forWeek: number | null): Promise<{ gate: Gate; data: PanelData | null }> => {
      try {
        const qs = forWeek ? `?week=${forWeek}` : "";
        const res = await fetch(`/api/pickem/${slug}/panel/${qs}`, { cache: "no-store" });
        if (res.status === 401) return { gate: "anon", data: null };
        if (res.status === 403) return { gate: "forbidden", data: null };
        if (!res.ok) return { gate: "error", data: null };
        return { gate: "ready", data: (await res.json()) as PanelData };
      } catch {
        return { gate: "error", data: null };
      }
    },
    [slug],
  );

  const load = useCallback(
    async (forWeek?: number | null) => {
      const target = forWeek === undefined ? week : forWeek;
      const next = await fetchSnapshot(target);
      setGate(next.gate);
      setData(next.data);
      if (next.data) setWeek(next.data.week.week);
    },
    [fetchSnapshot, week],
  );

  useEffect(() => {
    let alive = true;
    fetchSnapshot(null).then((next) => {
      if (!alive) return;
      setGate(next.gate);
      setData(next.data);
      if (next.data) setWeek(next.data.week.week);
    });
    return () => {
      alive = false;
    };
  }, [fetchSnapshot]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(timer);
  }, [toast]);

  const notify = useCallback((text: string, bad?: boolean) => setToast({ text, bad }), []);

  if (gate === "loading") {
    return (
      <div className="sg-screen">
        <div className="sg-pad">
          <p className="sg-body">Cargando el panel…</p>
        </div>
      </div>
    );
  }

  if (gate === "anon") return <SignInGate onSignedIn={() => void load(null)} />;
  if (gate === "forbidden") return <ForbiddenGate slug={slug} />;

  if (gate === "error" || !data) {
    return (
      <div className="sg-screen">
        <div className="sg-pad pkp-gate">
          <h1 className="sg-h" style={{ fontSize: 20 }}>No pudimos cargar el panel</h1>
          <button className="sg-btn ghost" onClick={() => void load(null)}>
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  const { program, staff } = data;

  return (
    <div className="sg-screen">
      <div className="sg-pad pkp">
        <div>
          <div className="sg-eyebrow">Panel de operación</div>
          <div className="pkp-title">{program.name}</div>
          <div className="sg-foot">
            {staff.email} · rol {staff.role} · jornada abierta J{program.openWeek}
          </div>
        </div>

        <nav className="pkp-nav">
          <button aria-current={view === "jornada"} onClick={() => setView("jornada")}>
            Jornada
          </button>
          <button aria-current={view === "caja"} onClick={() => setView("caja")}>
            Caja
          </button>
          <button aria-current={view === "ajustes"} onClick={() => setView("ajustes")}>
            Ajustes
          </button>
        </nav>

        {view === "jornada" && (
          <WeekView
            slug={slug}
            program={program}
            staff={staff}
            snapshot={data.week}
            onWeek={(w) => void load(w)}
            onDone={async (message, bad) => {
              notify(message, bad);
              if (!bad) await load();
            }}
          />
        )}

        {view === "caja" && (
          <DeskView
            slug={slug}
            program={program}
            staff={staff}
            pending={data.pendingAwards}
            onDone={async (message, bad) => {
              notify(message, bad);
              if (!bad) await load();
            }}
          />
        )}

        {view === "ajustes" && (
          <AdjustView
            slug={slug}
            staff={staff}
            onDone={(message, bad) => notify(message, bad)}
          />
        )}

        {/* Sticky rather than fixed: the frame scrolls its own middle, and a
            fixed toast on iOS lands relative to the viewport, which put it over
            the dock of the player's app when both were open. */}
        {toast && (
          <div className={`pkp-toast${toast.bad ? " bad" : ""}`} role="status">
            {toast.text}
          </div>
        )}

        <button
          type="button"
          className="sg-btn ghost sm"
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
// Getting in
// ---------------------------------------------------------------------------

type GateMode = "password" | "otp-email" | "otp-code";

/**
 * Password first, a code by email as the way back in.
 *
 * The same two doors the tickets console offers, and for the same reason: this
 * project has no SMTP of its own yet and the built-in sender caps at two mails
 * an hour, so an OTP-only gate locks the third person out of a launch. The copy
 * says which of the two failures happened, because "wait a minute" is a lie
 * when the budget rather than the cooldown is what refused.
 */
function SignInGate({ onSignedIn }: { onSignedIn: () => void }) {
  const [mode, setMode] = useState<GateMode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
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
    // One message for a wrong password and for an unknown account: telling them
    // apart confirms which addresses have panel accounts.
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
      const throttle = authThrottleKind(authError);
      return setError(
        throttle === "cooldown"
          ? "Pediste códigos muy seguido. Espera un minuto e intenta otra vez."
          : throttle === "project"
            ? "El proyecto agotó su cuota de correos de esta hora. Es configuración, no tu cuenta: entra con contraseña o pide que revisen el SMTP."
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
    <div className="sg-field">
      <label htmlFor="pkp-email">Correo de tu cuenta</label>
      <input
        id="pkp-email"
        type="email"
        autoComplete="username"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onEnter()}
      />
    </div>
  );

  return (
    <div className="sg-screen">
      <div className="sg-pad pkp pkp-gate">
        <h1 className="sg-h" style={{ fontSize: 21 }}>Panel de operación</h1>
        {error && <p className="sg-error">{error}</p>}

        {mode === "password" && (
          <>
            {emailField(() => void signIn())}
            <div className="sg-field">
              <label htmlFor="pkp-pass">Contraseña</label>
              <input
                id="pkp-pass"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void signIn()}
              />
            </div>
            <button
              className="sg-btn"
              disabled={busy || !email || !password}
              onClick={() => void signIn()}
            >
              {busy ? "Entrando…" : "Entrar"}
            </button>
            <button className="sg-btn ghost sm" onClick={() => go("otp-email")}>
              Entrar con un código por correo
            </button>
          </>
        )}

        {mode === "otp-email" && (
          <>
            {emailField(() => void send())}
            <button className="sg-btn" disabled={busy || !email} onClick={() => void send()}>
              {busy ? "Enviando…" : "Enviar código"}
            </button>
            <button className="sg-btn ghost sm" onClick={() => go("password")}>
              Mejor con contraseña
            </button>
          </>
        )}

        {mode === "otp-code" && (
          <>
            {sentTo ? (
              <p className="sg-body">Código enviado a <b>{sentTo}</b>.</p>
            ) : (
              emailField(() => void verify())
            )}
            <div className="sg-field">
              <label htmlFor="pkp-otp">Código</label>
              <input
                id="pkp-otp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={10}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              />
            </div>
            <button
              className="sg-btn"
              disabled={busy || code.length < 6}
              onClick={() => void verify()}
            >
              {busy ? "Verificando…" : "Entrar"}
            </button>
            <button className="sg-btn ghost sm" onClick={() => go("password")}>
              Mejor con contraseña
            </button>
          </>
        )}

        <p className="sg-foot">
          El acceso se otorga por programa. Si tu cuenta no está en la lista de
          operación, pide que te agreguen antes de entrar.
        </p>
      </div>
    </div>
  );
}

function ForbiddenGate({ slug }: { slug: string }) {
  return (
    <div className="sg-screen">
      <div className="sg-pad pkp pkp-gate">
        <h1 className="sg-h" style={{ fontSize: 21 }}>Sin acceso a este programa</h1>
        <p className="sg-body">
          Tu sesión es válida, pero tu cuenta no está en la lista de operación de{" "}
          <b>{slug}</b>. Tener cuenta no autoriza nada por sí solo.
        </p>
        <button
          className="sg-btn ghost"
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

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import QRCode from "qrcode";
import type { LiveData, LiveFeedItem } from "@/app/api/tickets/[campana]/admin/live/route";

type Gate = "loading" | "anon" | "forbidden" | "error" | "ready";

const POLL_MS = 3000;
const STAGE_W = 1920;
const STAGE_H = 1080;

/** Supergana's own cast, for tenants that ship no mascots of their own. */
const DEFAULT_CHARACTERS = {
  greet: "/characters/v2/gato.png",
  celebrate: "/characters/v2/oso.png",
  ticket: "/characters/v2/cebra.png",
  point: "/characters/v2/lince.png",
} as const;

const usd = (cents: number) => `$${Math.round(cents / 100).toLocaleString("en-US")}`;
const int = (n: number) => Math.round(n).toLocaleString("en-US");

const ago = (nowMs: number, atIso: string): string => {
  const s = Math.max(0, Math.floor((nowMs - Date.parse(atIso)) / 1000));
  if (s < 5) return "ahora";
  if (s < 60) return `hace ${s} s`;
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  return `hace ${Math.floor(s / 3600)} h`;
};

/**
 * Counts toward `target` instead of jumping to it. A number that rolls up is
 * what tells a room of people "that was you"; a number that silently changes
 * is not noticed from four metres away.
 */
function useCountUp(target: number): number {
  const [shown, setShown] = useState(0);
  const shownRef = useRef(0);
  useEffect(() => {
    const from = shownRef.current;
    if (from === target) return;
    const started = performance.now();
    const duration = 900;
    let frame = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - started) / duration);
      const eased = 1 - Math.pow(1 - k, 3);
      const value = from + (target - from) * eased;
      shownRef.current = value;
      setShown(value);
      if (k < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target]);
  return shown;
}

function Counter({
  label,
  value,
  suffix,
  className,
  hint,
}: {
  label: string;
  value: number;
  suffix?: string;
  className?: string;
  hint?: string;
}) {
  const shown = useCountUp(value);
  return (
    <div className={`lv-card lv-counter ${className ?? ""}`}>
      <div className="lv-counter-label">{label}</div>
      {/* `key` restarts the pop animation each time the real value changes. */}
      <div key={value} className="lv-counter-value">
        {int(shown)}
        {suffix && <span className="lv-counter-suffix">{suffix}</span>}
      </div>
      {hint && <div className="lv-counter-hint">{hint}</div>}
    </div>
  );
}

function Icon({ kind }: { kind: "ticket" | "gift" | "bolt" | "full" }) {
  const common = {
    width: "100%",
    height: "100%",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2.4,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (kind === "ticket")
    return (
      <svg {...common}>
        <path d="M4 7h16v3a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4z" />
        <path d="m9.5 12 1.8 1.8 3.4-3.6" />
      </svg>
    );
  if (kind === "gift")
    return (
      <svg {...common}>
        <path d="M4 10h16v10H4zM3 7h18v3H3zM12 7v13" />
        <path d="M12 7c-1-3-5-3.5-5-1.2C7 7.2 9 7 12 7zm0 0c1-3 5-3.5 5-1.2C17 7.2 15 7 12 7z" />
      </svg>
    );
  if (kind === "bolt")
    return (
      <svg {...common}>
        <path d="M13 3 5 13h6l-1 8 8-10h-6z" />
      </svg>
    );
  return (
    <svg {...common}>
      <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
    </svg>
  );
}

function FeedRow({
  item,
  nowMs,
  fresh,
}: {
  item: LiveFeedItem;
  nowMs: number;
  fresh: boolean;
}) {
  const isTicket = item.kind === "ticket";
  return (
    <li className={`lv-feed-item ${fresh ? "fresh" : ""} ${isTicket ? "ticket" : "redeem"}`}>
      <span className="lv-feed-icon">
        <Icon kind={isTicket ? "ticket" : "gift"} />
      </span>
      <div className="lv-feed-body">
        <div className="lv-feed-who">{item.alias}</div>
        <div className="lv-feed-what">
          {item.kind === "ticket"
            ? item.products.length > 0
              ? item.products.join(" · ")
              : "Ticket aprobado"
            : `Canjeó ${item.prize}`}
        </div>
      </div>
      <div className="lv-feed-side">
        {item.kind === "ticket" ? (
          <span className="lv-feed-pts">+{int(item.points)} pts</span>
        ) : (
          <span className="lv-feed-pts redeem">Premio</span>
        )}
        <span className="lv-feed-ago">
          {item.kind === "ticket" && item.auto && <span className="lv-auto">AUTO</span>}
          {ago(nowMs, item.at)}
        </span>
      </div>
    </li>
  );
}

export function LiveScreen({ slug }: { slug: string }) {
  const [gate, setGate] = useState<Gate>("loading");
  const [data, setData] = useState<LiveData | null>(null);
  const [stale, setStale] = useState(false);
  const [qrSrc, setQrSrc] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [clockSkew, setClockSkew] = useState(0);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [banner, setBanner] = useState<LiveFeedItem | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  // Ids already shown: the first snapshot must not celebrate the whole backlog.
  const seen = useRef<Set<string> | null>(null);
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- polling -------------------------------------------------------------
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;

    const tick = async () => {
      const controller = new AbortController();
      const abort = setTimeout(() => controller.abort(), 6000);
      try {
        const res = await fetch(`/api/tickets/${slug}/admin/live/`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!alive) return;
        // Being signed out is a fact, not a hiccup: say so. Everything else
        // keeps the last good data on screen.
        if (res.status === 401) return setGate("anon");
        if (res.status === 403) return setGate("forbidden");
        if (!res.ok) throw new Error(String(res.status));
        const next = (await res.json()) as LiveData;
        if (!alive) return;

        const incoming = next.feed.filter((f) => !seen.current?.has(f.id));
        if (seen.current && incoming.length > 0) {
          setFresh(new Set(incoming.map((f) => f.id)));
          setBanner(incoming[0]);
          if (bannerTimer.current) clearTimeout(bannerTimer.current);
          bannerTimer.current = setTimeout(() => setBanner(null), 4200);
          setTimeout(() => alive && setFresh(new Set()), 5000);
        }
        seen.current = new Set(next.feed.map((f) => f.id));

        setClockSkew(Date.now() - Date.parse(next.serverTime));
        setData(next);
        setGate("ready");
        setStale(false);
      } catch {
        if (!alive) return;
        // Keep whatever is already on the projector; only the first load can
        // fail loudly, because there is nothing to keep.
        setStale(true);
        setGate((g) => (g === "loading" ? "error" : g));
      } finally {
        clearTimeout(abort);
        if (alive) timer = setTimeout(tick, POLL_MS);
      }
    };
    void tick();
    return () => {
      alive = false;
      clearTimeout(timer);
      if (bannerTimer.current) clearTimeout(bannerTimer.current);
    };
  }, [slug]);

  // --- relative times tick once a second -----------------------------------
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // --- the stage is a fixed 1920x1080 canvas, scaled to whatever fits -------
  // A projector, a 1280x720 laptop and a 4K TV must all show the SAME layout;
  // reflowing a dashboard to a room's screen is how it ends up cropped.
  useEffect(() => {
    const fit = () =>
      setScale(Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // --- QR ------------------------------------------------------------------
  const joinUrl = data?.joinUrl ?? null;
  useEffect(() => {
    if (!joinUrl) return;
    let alive = true;
    QRCode.toDataURL(joinUrl, {
      margin: 0,
      width: 720,
      errorCorrectionLevel: "M",
      color: { dark: "#0A0A0A", light: "#FFFFFF" },
    }).then((src) => alive && setQrSrc(src));
    return () => {
      alive = false;
    };
  }, [joinUrl]);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen();
  }, []);

  // --- gates ---------------------------------------------------------------
  if (gate !== "ready" || !data) {
    return (
      <div className="lv-root lv-gate">
        <div className="lv-gate-box">
          <h1>
            {gate === "loading" && "Cargando pantalla…"}
            {gate === "anon" && "Inicia sesión como staff"}
            {gate === "forbidden" && "Tu cuenta no tiene acceso a esta campaña"}
            {gate === "error" && "No pudimos cargar la pantalla"}
          </h1>
          {gate !== "loading" && (
            <p>
              {gate === "error" ? (
                <a href="" onClick={() => window.location.reload()}>
                  Reintentar
                </a>
              ) : (
                <a href={`/admin/${slug}/`}>Ir a la consola</a>
              )}
            </p>
          )}
        </div>
      </div>
    );
  }

  const { counters, theme, campaign } = data;
  const brandStyle = (theme.brand ? { "--lv-brand": theme.brand } : {}) as CSSProperties;
  const mascot = (pose: keyof typeof DEFAULT_CHARACTERS) =>
    theme.mascots[pose] ?? DEFAULT_CHARACTERS[pose];
  const nowAdjusted = nowMs - clockSkew;
  const mixTotal = data.mix.reduce((sum, b) => sum + b.cents, 0);
  const empty = counters.tickets === 0 && data.feed.length === 0;
  const origin = data.joinUrl.replace(/^https?:\/\//, "");

  return (
    <div className="lv-root" style={brandStyle}>
      <div
        className="lv-stage"
        style={{
          transform: `translate(-50%, -50%) scale(${scale})`,
        }}
      >
        {/* ---- header ---------------------------------------------------- */}
        <header className="lv-head">
          <div className="lv-cobrand">
            {theme.logoUrl && (
              // Plain <img>: a theme's logo URL is data (see TicketsShell).
              // eslint-disable-next-line @next/next/no-img-element
              <img className="lv-logo" src={theme.logoUrl} alt={theme.logoAlt ?? campaign.orgName} />
            )}
            {theme.logoUrl && theme.poweredBy && <span className="lv-x">×</span>}
            {(!theme.logoUrl || theme.poweredBy) && (
              <span className="lv-sg">
                <span className="lv-sg-dot" />
                {theme.logoUrl ? (
                  <>
                    <small>Powered by</small> supergana
                  </>
                ) : (
                  "supergana"
                )}
              </span>
            )}
          </div>

          <h1 className="lv-title">{campaign.name}</h1>

          <div className="lv-head-right">
            {stale && (
              <span className="lv-reconnect" role="status">
                <span className="lv-spinner" /> reconectando
              </span>
            )}
            <span className="lv-live">
              <span className="lv-live-dot" /> EN VIVO
            </span>
            <button
              type="button"
              className="lv-fs"
              onClick={toggleFullscreen}
              aria-label={fullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
              title={fullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
            >
              <Icon kind="full" />
            </button>
          </div>
        </header>

        <div className="lv-flag" aria-hidden="true" />

        <main className="lv-grid">
          {/* ---- column A: QR + top 5 ------------------------------------- */}
          <section className="lv-col lv-col-a">
            <div className="lv-card lv-qr">
              <div className="lv-qr-kicker">Escanea y juega</div>
              <div className="lv-qr-frame">
                {qrSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={qrSrc} alt={`Código QR hacia ${origin}`} />
                ) : (
                  <div className="lv-qr-skeleton" />
                )}
              </div>
              <div className="lv-qr-url">{origin}</div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="lv-peek" src={mascot("greet")} alt="" aria-hidden="true" />
            </div>

            <div className="lv-card lv-top">
              <div className="lv-card-title">
                <span className="lv-card-icon">
                  <Icon kind="bolt" />
                </span>
                Los 5 primeros
              </div>
              {/* Always five rows: empty seats are drawn as dashed ghosts so the
                  ranking visibly has room to fill during the demo. */}
              <ol className="lv-rank">
                {Array.from({ length: 5 }, (_, i) => data.top[i] ?? null).map((row, i) =>
                  row ? (
                    <li key={row.rank} className={`pos-${row.rank}`}>
                      <span className="lv-rank-n">{row.rank}</span>
                      <span className="lv-rank-who">{row.alias}</span>
                      <span className="lv-rank-pts">{int(row.points)} pts</span>
                    </li>
                  ) : (
                    <li key={`ghost-${i}`} className="ghost">
                      <span className="lv-rank-n">{i + 1}</span>
                      <span className="lv-rank-who">Lugar libre</span>
                      <span className="lv-rank-pts">—</span>
                    </li>
                  ),
                )}
              </ol>
            </div>
          </section>

          {/* ---- column B: counters + brand mix --------------------------- */}
          <section className="lv-col lv-col-b">
            <div className="lv-row lv-row-big">
              <Counter label="Tickets subidos" value={counters.tickets} className="hero" />
              <Counter label="Participantes" value={counters.participants} />
            </div>
            <div className="lv-row lv-row-small">
              <Counter
                label="Aprobados por la máquina"
                value={counters.autoPct ?? 0}
                suffix="%"
                hint={
                  counters.approved > 0
                    ? `${counters.autoApproved} de ${counters.approved} sin revisión humana`
                    : "ningún ticket aprobado aún"
                }
              />
              <Counter label="Puntos repartidos" value={counters.points} />
              <Counter label="Premios canjeados" value={counters.redemptions} />
            </div>

            <div className="lv-card lv-mix">
              <div className="lv-card-title">
                <span className="lv-card-icon">
                  <Icon kind="ticket" />
                </span>
                Qué se está comprando
              </div>
              <div className="lv-bars">
                {data.mix.length === 0 && <p className="lv-muted">Sin marcas configuradas.</p>}
                {data.mix.map((b) => {
                  const share = mixTotal > 0 ? b.cents / mixTotal : 0;
                  return (
                    <div className="lv-bar" key={b.brand}>
                      <div className="lv-bar-head">
                        <span className="lv-bar-name">
                          {b.logoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={b.logoUrl} alt={b.brand} />
                          ) : (
                            <>
                              <i style={{ background: b.color }} />
                              {b.brand}
                            </>
                          )}
                        </span>
                        <span className="lv-bar-num">
                          <strong>{usd(b.cents)}</strong>
                          <em>
                            {int(b.units)} {b.units === 1 ? "producto" : "productos"} ·{" "}
                            {Math.round(share * 100)}%
                          </em>
                        </span>
                      </div>
                      <div className="lv-bar-track">
                        <div
                          className="lv-bar-fill"
                          style={{
                            width: `${share * 100}%`,
                            background: b.color,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* ---- column C: live feed -------------------------------------- */}
          <section className="lv-col lv-col-c">
            <div className="lv-card lv-feed">
              <div className="lv-card-title">
                <span className="lv-card-icon">
                  <Icon kind="bolt" />
                </span>
                Actividad en vivo
              </div>
              {empty || data.feed.length === 0 ? (
                <div className="lv-empty">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={mascot("point")} alt="" aria-hidden="true" />
                  <p>
                    Esperando el primer ticket
                    <span className="lv-dots">
                      <i>.</i>
                      <i>.</i>
                      <i>.</i>
                    </span>
                  </p>
                  <small>Escanea el código y sube el tuyo.</small>
                </div>
              ) : (
                <ul className="lv-feed-list">
                  {data.feed.map((item) => (
                    <FeedRow
                      key={item.id}
                      item={item}
                      nowMs={nowAdjusted}
                      fresh={fresh.has(item.id)}
                    />
                  ))}
                </ul>
              )}
            </div>
          </section>
        </main>

        {/* ---- celebration banner for the newest event ------------------- */}
        {banner && (
          <div key={banner.id} className="lv-banner" role="status">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={mascot("celebrate")} alt="" aria-hidden="true" />
            <div>
              <div className="lv-banner-kicker">
                {banner.kind === "ticket" ? "Ticket aprobado" : "Premio canjeado"}
              </div>
              <div className="lv-banner-main">
                {banner.alias}
                <span>
                  {banner.kind === "ticket" ? `+${int(banner.points)} pts` : banner.prize}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

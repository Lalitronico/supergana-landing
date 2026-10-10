"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import QRCode from "qrcode";
import type {
  LiveData,
  LiveFeedItem,
  LiveFigure,
} from "@/app/api/tickets/[campana]/admin/live/route";
import { SuperganaWordmark } from "@/app/c/[campana]/fiesta/Wordmark";

type Gate = "loading" | "anon" | "forbidden" | "error" | "ready";

const POLL_MS = 3000;
const STAGE_W = 1920;
const STAGE_H = 1080;
/** Fewest lanes drawn: a lone racer still gets a track that looks like a race. */
const MIN_LANES = 4;
/** Height of the track in stage pixels; mirrors --track-h in live.css. */
const TRACK_H = 586;

/** Supergana's own cast, for tenants that ship no cast and no mascots. */
const DEFAULT_CHARACTERS = [
  "/characters/v2/gato.png",
  "/characters/v2/oso.png",
  "/characters/v2/cebra.png",
  "/characters/v2/lince.png",
];

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
 * Counts toward `target` instead of jumping to it. The number rolls up like a
 * pump display: a room notices "that was us" far more than a silent change.
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
  tone,
  hint,
  empty,
}: {
  label: string;
  value: number;
  suffix?: string;
  tone: string;
  hint?: string;
  /** Neutral "nothing yet" state: a dash instead of a discouraging zero. */
  empty?: boolean;
}) {
  const shown = useCountUp(value);
  return (
    <div className={`lv-card lv-counter ${tone}`}>
      <div className="lv-counter-label">{label}</div>
      {/* `key` restarts the pop animation each time the real value changes. */}
      <div key={value} className={`lv-counter-value ${empty ? "empty" : ""}`}>
        {empty ? "—" : int(shown)}
        {!empty && suffix && <span className="lv-counter-suffix">{suffix}</span>}
      </div>
      {hint && <div className="lv-counter-hint">{hint}</div>}
    </div>
  );
}

function Icon({ kind }: { kind: "ticket" | "gift" | "bolt" | "full" | "flag" }) {
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
        <path d="M12 7c-1-3-5-3.5-5-1.2C7 7.2 9 7 12 7zm0 0c1-3 5-3.5 5-1.2C17 7.2 15 7.2 12 7z" />
      </svg>
    );
  if (kind === "bolt")
    return (
      <svg {...common}>
        <path d="M13 3 5 13h6l-1 8 8-10h-6z" />
      </svg>
    );
  if (kind === "flag")
    return (
      <svg {...common}>
        <path d="M5 21V4M5 4h11l-2 4 2 4H5" />
      </svg>
    );
  return (
    <svg {...common}>
      <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
    </svg>
  );
}

/** A character's face in a ring; an initial when the tenant has no cast. */
function Avatar({
  figure,
  alias,
  className,
}: {
  figure: LiveFigure | null;
  alias: string;
  className?: string;
}) {
  return (
    <span className={`lv-avatar ${className ?? ""}`}>
      {figure ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={figure.image} alt="" aria-hidden="true" draggable={false} />
      ) : (
        <b>{alias.charAt(0).toUpperCase()}</b>
      )}
    </span>
  );
}

/** A brand's logo; its name when the logo is missing or fails to load. */
function BrandMark({ name, logoUrl }: { name: string; logoUrl: string | null }) {
  const [failed, setFailed] = useState(false);
  if (!logoUrl || failed) return <span className="lv-brand-name">{name}</span>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img className="lv-brand-logo" src={logoUrl} alt={name} onError={() => setFailed(true)} />
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
        <Avatar figure={item.avatar} alias={item.alias} />
        {isTicket && item.auto ? (
          <span className="lv-feed-badge auto">AUTO</span>
        ) : (
          <span className="lv-feed-badge">
            <Icon kind={isTicket ? "ticket" : "gift"} />
          </span>
        )}
      </span>
      <div className="lv-feed-body">
        <div className="lv-feed-who">
          <span className="lv-feed-name">{item.alias}</span>
        </div>
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
        <span className="lv-feed-ago">{ago(nowMs, item.at)}</span>
      </div>
    </li>
  );
}

/** Real facts computed from the snapshot; nothing here is filler. */
function buildFacts(data: LiveData): { kicker: string; text: string }[] {
  const facts: { kicker: string; text: string }[] = [];
  if (data.topProduct) {
    facts.push({
      kicker: "Lo más comprado",
      text: `${data.topProduct.label} ×${int(data.topProduct.units)}`,
    });
  }
  const total = data.mix.reduce((sum, b) => sum + b.cents, 0);
  const leader = [...data.mix].sort((a, b) => b.cents - a.cents)[0];
  if (leader && total > 0) {
    facts.push({
      kicker: "Marca líder",
      text: `${leader.brand} · ${Math.round((leader.cents / total) * 100)}% del gasto`,
    });
  }
  if (data.counters.approved > 0) {
    facts.push({
      kicker: "Ticket promedio",
      text: `${int(data.counters.points / data.counters.approved)} puntos por ticket`,
    });
  }
  return facts;
}

/** One fact at a time, swapped every few seconds. Hidden when there are none. */
function FactStrip({ facts }: { facts: { kicker: string; text: string }[] }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 6000);
    return () => clearInterval(id);
  }, []);
  if (facts.length === 0) return null;
  const fact = facts[tick % facts.length];
  return (
    <div className="lv-fact" key={fact.kicker}>
      <span className="lv-fact-kicker">{fact.kicker}</span>
      <span className="lv-fact-text">{fact.text}</span>
    </div>
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
  const [passers, setPassers] = useState<Set<string>>(new Set());
  const [banner, setBanner] = useState<LiveFeedItem | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  // Ids already shown: the first snapshot must not celebrate the whole backlog.
  const seen = useRef<Set<string> | null>(null);
  const lastRank = useRef<Map<string, number>>(new Map());
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

        // Overtakes: anyone whose rank number got smaller since the last
        // snapshot (or who just entered the board after the first load).
        const overtakers = new Set<string>();
        const hadBoard = lastRank.current.size > 0;
        for (const row of next.top) {
          const before = lastRank.current.get(row.id);
          if (before !== undefined ? row.rank < before : hadBoard) overtakers.add(row.id);
        }
        lastRank.current = new Map(next.top.map((r) => [r.id, r.rank]));
        if (overtakers.size > 0) {
          setPassers(overtakers);
          setTimeout(() => alive && setPassers(new Set()), 3200);
        }

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
  const cast = data.cast;

  // Art for the stage: the tenant's cast, else its mascots, else Supergana's.
  const mascotList = Object.values(theme.mascots);
  const stage: string[] = cast.length
    ? cast.map((m) => m.image)
    : mascotList.length
      ? mascotList
      : DEFAULT_CHARACTERS;
  const art = (i: number) => stage[i % stage.length];
  const nowAdjusted = nowMs - clockSkew;

  // Seconds while it is quick, minutes once it is not: "8 s" is the pitch.
  const avg = counters.autoAvgSeconds ?? 0;
  const autoTime =
    avg < 90
      ? { value: Math.max(1, Math.round(avg)), unit: " s" }
      : { value: Math.round(avg / 60), unit: " min" };
  const facts = buildFacts(data);
  const empty = counters.tickets === 0 && data.feed.length === 0;
  const origin = data.joinUrl.replace(/^https?:\/\//, "");

  // The race: distance is proportional to points, scaled so the leader stops a
  // little short of the flag until somebody earns more than they have.
  const leaderPoints = data.top[0]?.points ?? 0;
  const goal = Math.max(leaderPoints * 1.1, 400);
  // Only lanes with a racer, never fewer than MIN_LANES; the lane height (and
  // with it the avatar) follows, so four racers get big characters.
  const laneCount = Math.max(MIN_LANES, data.top.length);
  const laneH = TRACK_H / laneCount;
  const maxCents = Math.max(1, ...data.mix.map((b) => b.cents));

  return (
    <div className={`lv-root ${theme.brandLight ? "brand-light" : ""}`} style={brandStyle}>
      <div
        className="lv-stage"
        style={{
          transform: `translate(-50%, -50%) scale(${scale})`,
        }}
      >
        <div className="lv-rays" aria-hidden="true" />

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
                {theme.logoUrl && <small>Powered by</small>}
                <SuperganaWordmark size={42} />
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

        {/* ---- KPI strip: low, so the race gets the board ---------------- */}
        <div className="lv-kpis">
          <Counter label="Tickets subidos" value={counters.tickets} tone="t-brand" />
          <Counter label="Participantes" value={counters.participants} tone="t-blue" />
          <Counter
            label="Validación automática"
            value={autoTime.value}
            suffix={autoTime.unit}
            tone="t-green"
            empty={counters.autoAvgSeconds === null}
            hint={
              counters.autoAvgSeconds === null
                ? "esperando el primero"
                : `${counters.autoApproved} de ${counters.approved} tickets solos`
            }
          />
          <Counter label="Puntos repartidos" value={counters.points} tone="t-pink" />
          <Counter label="Premios canjeados" value={counters.redemptions} tone="t-purple" />
        </div>

        <main className="lv-grid">
          {/* ---- column A: QR + brand mix --------------------------------- */}
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
              <img className="lv-peek" src={art(0)} alt="" aria-hidden="true" />
            </div>

            <div className="lv-card lv-mix">
              <div className="lv-card-title small">Qué se está comprando</div>
              <div className="lv-bars">
                {data.mix.length === 0 && <p className="lv-muted">Sin marcas configuradas.</p>}
                {data.mix.map((b) => {
                  // Normalised against the leader: the biggest brand fills the lane.
                  const share = b.cents / maxCents;
                  return (
                    <div className="lv-bar" key={b.brand}>
                      <span className="lv-bar-name">
                        <BrandMark name={b.brand} logoUrl={b.logoUrl} />
                      </span>
                      <div className="lv-bar-track">
                        <div
                          className="lv-bar-fill"
                          style={{ width: `${share * 100}%`, background: b.color }}
                        />
                        <span className="lv-bar-num">{usd(b.cents)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="lv-peek lv-peek-mix" src={art(5)} alt="" aria-hidden="true" />
            </div>
          </section>

          {/* ---- column B: the race, the protagonist ---------------------- */}
          <section className="lv-col lv-col-b">
            <div className="lv-card lv-race">
              <div className="lv-race-head">
                <div className="lv-card-title">
                  <span className="lv-card-icon">
                    <Icon kind="flag" />
                  </span>
                  La carrera
                </div>
                <span className="lv-race-sub">más puntos, más cerca de la meta</span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="lv-peek lv-peek-race" src={art(2)} alt="" aria-hidden="true" />
              </div>

              <div
                className="lv-track"
                style={{ "--lanes": laneCount, "--lane": `${laneH}px` } as CSSProperties}
              >
                {Array.from({ length: laneCount }, (_, i) => (
                  <div className="lv-lane-line" key={i} style={{ top: i * laneH }}>
                    <span>{i + 1}</span>
                  </div>
                ))}
                <div className="lv-finish" aria-hidden="true" />

                {data.top.length === 0 && (
                  <div className="lv-race-empty">
                    <div className="lv-start-line">
                      {stage.slice(0, 4).map((src, i) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={src}
                          src={src}
                          alt=""
                          aria-hidden="true"
                          style={{ animationDelay: `${i * 380}ms` }}
                        />
                      ))}
                    </div>
                    <p>¡En sus marcas! Sube un ticket y arranca la carrera.</p>
                  </div>
                )}

                {data.top.map((row) => {
                  const p = Math.min(1, row.points / goal);
                  return (
                    <div
                      key={row.id}
                      className={`lv-racer ${passers.has(row.id) ? "pass" : ""} ${row.rank === 1 ? "lead" : ""}`}
                      style={{ top: (row.rank - 1) * laneH, "--p": p } as CSSProperties}
                    >
                      <div className="lv-runner">
                        <Avatar figure={row.avatar} alias={row.alias} className="big" />
                        <span className="lv-tag">
                          <b>{row.alias}</b>
                          <i>{int(row.points)}</i>
                        </span>
                        {passers.has(row.id) && <span className="lv-up">▲</span>}
                      </div>
                    </div>
                  );
                })}
              </div>

              <FactStrip facts={facts} />
            </div>
          </section>

          {/* ---- column C: live feed -------------------------------------- */}
          <section className="lv-col lv-col-c">
            <div className="lv-card lv-feed">
              <div className="lv-card-title lv-feed-title">
                <span className="lv-card-icon">
                  <Icon kind="bolt" />
                </span>
                Actividad en vivo
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="lv-peek lv-peek-feed" src={art(4)} alt="" aria-hidden="true" />
              {empty || data.feed.length === 0 ? (
                <div className="lv-empty">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={art(1)} alt="" aria-hidden="true" />
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

            {/* Celebration toast, over the feed so it never covers numbers. The
                character is the cameo of the brand that dominates the ticket. */}
            {banner && (
              <div key={banner.id} className="lv-banner" role="status">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={
                    (banner.kind === "ticket" && banner.cameo?.image) ||
                    banner.avatar?.image ||
                    art(1)
                  }
                  alt=""
                  aria-hidden="true"
                />
                <div className="lv-banner-text">
                  <div className="lv-banner-kicker">
                    {banner.kind === "ticket" ? "Ticket aprobado" : "Premio canjeado"}
                  </div>
                  <div className="lv-banner-main">
                    <b>{banner.alias}</b>
                    <span>
                      {banner.kind === "ticket" ? `+${int(banner.points)} pts` : banner.prize}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { PRIZE_KINDS, REDEEM_ERROR_ES, type PrizeKind } from "@/lib/tickets/store";
import type { AdminDrop, AdminDropItem, StoreAdminData } from "./types";

const DROP_LABEL: Record<string, string> = {
  scheduled: "Preparando",
  open: "Abierto",
  closed: "Cerrado",
};

const DROP_PILL: Record<string, string> = {
  scheduled: "warn",
  open: "ok",
  closed: "mute",
};

const REDEMPTION_LABEL: Record<string, string> = {
  confirmed: "Por entregar",
  fulfilled: "Entregado",
  canceled: "Cancelado",
};

const REDEMPTION_PILL: Record<string, string> = {
  confirmed: "warn",
  fulfilled: "ok",
  canceled: "mute",
};

const KIND_LABEL: Record<PrizeKind, string> = {
  product: "Producto",
  recharge: "Recarga",
  giftcard: "Tarjeta",
  item: "Artículo",
  cash: "Efectivo",
};

const day = (iso: string) =>
  new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });

/**
 * The prize store, from the console.
 *
 * Reads its own endpoint instead of the shared snapshot: its tables arrive with
 * a migration, and a console that cannot load because one view's tables are
 * missing is a console that blocks the review queue over a pending deploy.
 */
export function StoreView({
  slug,
  onNotify,
}: {
  slug: string;
  onNotify: (message: string, bad?: boolean) => void | Promise<void>;
}) {
  const [data, setData] = useState<StoreAdminData | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  const fetchSnapshot = useCallback(async (): Promise<StoreAdminData | null> => {
    try {
      const res = await fetch(`/api/tickets/${slug}/admin/store/`, { cache: "no-store" });
      if (!res.ok) return null;
      return (await res.json()) as StoreAdminData;
    } catch {
      return null;
    }
  }, [slug]);

  const load = useCallback(async () => {
    const next = await fetchSnapshot();
    if (next) setData(next);
    else setFailed(true);
  }, [fetchSnapshot]);

  useEffect(() => {
    let alive = true;
    fetchSnapshot().then((next) => {
      if (!alive) return;
      if (next) setData(next);
      else setFailed(true);
    });
    return () => {
      alive = false;
    };
  }, [fetchSnapshot]);

  const act = async (body: Record<string, unknown>, success: string) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/tickets/${slug}/admin/store/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        error?: string;
        claimed?: number;
        now?: string;
      };
      if (!res.ok) {
        const message =
          payload.error === "drop_exists"
            ? "Esta semana ya tiene su Drop. Refresca la vista."
            : payload.error === "inventory_below_claimed"
              ? `No puedes dejar el inventario por debajo de los ${payload.claimed} ya canjeados: esos códigos son promesas que alguien tiene en la mano.`
              : payload.error === "role_cannot_manage_store"
                ? "Tu rol puede ver la tienda pero no curarla. Eso corresponde a supervisión o administración."
                : (REDEEM_ERROR_ES[payload.error ?? ""] ??
                  `No se pudo completar: ${payload.error ?? "error"}`);
        await onNotify(message, true);
        return false;
      }
      await load();
      await onNotify(success);
      return true;
    } finally {
      setBusy(false);
    }
  };

  if (!data && !failed) {
    return <div className="tka-card"><p className="tka-note">Cargando tienda…</p></div>;
  }

  if (failed || !data || !data.available) {
    // THE GUARD, console side. The tables land with migration 0013; until they
    // do this view says exactly that instead of pretending the store is empty.
    return (
      <>
        <div>
          <h2 className="tka-title">Tienda de Premios</h2>
          <div className="tka-sub">Drops semanales con inventario limitado.</div>
        </div>
        <div className="tka-card">
          <h3>Tienda no disponible</h3>
          <p className="tka-note" style={{ marginTop: 6 }}>
            Las tablas de la tienda (<span className="tka-mono">prize_drops</span>,{" "}
            <span className="tka-mono">prize_drop_items</span>,{" "}
            <span className="tka-mono">prize_redemptions</span>) todavía no existen en esta
            base. Se crean con la migración{" "}
            <span className="tka-mono">0013_prize_store.sql</span>; el Drop de ensayo viene
            en <span className="tka-mono">0014_seed_drop_ensayo_alaska.sql</span>. El resto
            de la consola funciona normal mientras tanto.
          </p>
        </div>
      </>
    );
  }

  const current = data.drops.find((d) => d.isCurrentWeek) ?? null;
  const past = data.drops.filter((d) => !d.isCurrentWeek);
  const pending = data.redemptions.filter((r) => r.status === "confirmed");

  return (
    <>
      <div>
        <h2 className="tka-title">Tienda de Premios</h2>
        <div className="tka-sub">
          Un Drop por semana, con inventario limitado y estricto orden de llegada. El
          inventario restante no se guarda: se cuenta desde los canjes, así que cancelar o
          agregar stock nunca deja dos números peleados. El status del Drop es curaduría —
          aunque quede &quot;abierto&quot;, el lunes siguiente la base lo rechaza sola.
        </div>
      </div>

      <div className="tka-grid4">
        <div className="tka-card tka-kpi">
          <div className="v">{current ? DROP_LABEL[current.status] : "—"}</div>
          <div className="l">Drop de esta semana</div>
          <div className="d">desde el {day(data.weekStart)}</div>
        </div>
        <div className="tka-card tka-kpi">
          <div className="v">
            {current ? current.items.reduce((s, i) => s + i.remaining, 0) : 0}
          </div>
          <div className="l">Premios disponibles</div>
          <div className="d">
            de {current ? current.items.reduce((s, i) => s + i.inventory, 0) : 0} en el Drop
          </div>
        </div>
        <div className="tka-card tka-kpi">
          <div className="v">{pending.length}</div>
          <div className="l">Canjes por entregar</div>
        </div>
        <div className="tka-card tka-kpi">
          <div className="v">
            {data.redemptions
              .filter((r) => r.status !== "canceled")
              .reduce((s, r) => s + r.pointsSpent, 0)}
          </div>
          <div className="l">Puntos canjeados</div>
          <div className="d">no bajan a nadie del ranking</div>
        </div>
      </div>

      {current ? (
        <DropCard
          drop={current}
          canManage={data.canManage}
          busy={busy}
          onAct={act}
        />
      ) : (
        <div className="tka-card">
          <h3>Sin Drop para la semana del {day(data.weekStart)}</h3>
          <p className="tka-note" style={{ marginTop: 6 }}>
            El participante ve &quot;el próximo Drop abre el lunes&quot;. Al crearlo nace en
            preparación, no abierto: primero se cargan los premios, luego se abre. Un Drop
            que abre vacío es una tienda vacía.
          </p>
          {data.canManage && (
            <button
              className="tka-btn"
              style={{ marginTop: 12 }}
              disabled={busy}
              onClick={() => void act({ action: "create_drop" }, "Drop creado en preparación")}
            >
              Crear Drop de esta semana
            </button>
          )}
        </div>
      )}

      <div className="tka-card tka-scroll">
        <h3>Cola de canjes</h3>
        <span className="tka-note">
          El código es lo que el participante muestra en tienda. Marcar entregado deja
          registro de quién lo hizo y cuándo.
        </span>
        <table style={{ marginTop: 10 }}>
          <thead>
            <tr>
              <th>Canjeado</th>
              <th>Participante</th>
              <th>Premio</th>
              <th>Código</th>
              <th>Puntos</th>
              <th>Estado</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {data.redemptions.length === 0 && (
              <tr>
                <td colSpan={7} style={{ color: "#6B665B" }}>
                  Todavía no hay canjes en esta campaña.
                </td>
              </tr>
            )}
            {data.redemptions.map((row) => (
              <tr key={row.id}>
                <td className="tka-mono">
                  {new Date(row.createdAt).toLocaleString("es-MX", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </td>
                <td>
                  <b>{row.participantName ?? row.participantAlias ?? "—"}</b>
                  <br />
                  <span style={{ fontSize: 11, color: "#6B665B" }}>{row.participantEmail}</span>
                </td>
                <td>{row.prizeName}</td>
                <td className="tka-mono" style={{ fontSize: 14, letterSpacing: "0.1em" }}>
                  {row.code}
                </td>
                <td>{row.pointsSpent}</td>
                <td>
                  <span className={`tka-pill ${REDEMPTION_PILL[row.status]}`}>
                    {REDEMPTION_LABEL[row.status]}
                  </span>
                </td>
                <td>
                  {row.status === "confirmed" && data.canManage ? (
                    <button
                      className="tka-btn ok sm"
                      disabled={busy}
                      onClick={() =>
                        void act(
                          { action: "fulfill", redemptionId: row.id },
                          `Canje ${row.code} marcado como entregado`,
                        )
                      }
                    >
                      Marcar entregado
                    </button>
                  ) : row.fulfilledAt ? (
                    <span className="tka-note">{day(row.fulfilledAt)}</span>
                  ) : (
                    <span className="tka-note">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!data.canManage && (
          <p className="tka-note" style={{ marginTop: 12 }}>
            Tu rol puede ver la tienda pero no curarla ni entregar premios. Eso corresponde a
            supervisión o administración.
          </p>
        )}
      </div>

      {past.length > 0 && (
        <div className="tka-card tka-scroll">
          <h3>Drops anteriores</h3>
          <span className="tka-note">
            Solo lectura: un Drop de otra semana ya no puede canjearse, aunque su status
            diga lo contrario.
          </span>
          <table style={{ marginTop: 10 }}>
            <thead>
              <tr>
                <th>Semana</th>
                <th>Status</th>
                <th>Premios</th>
                <th>Canjeados</th>
              </tr>
            </thead>
            <tbody>
              {past.map((drop) => (
                <tr key={drop.id}>
                  <td className="tka-mono">{day(drop.weekStart)}</td>
                  <td>
                    <span className={`tka-pill ${DROP_PILL[drop.status]}`}>
                      {DROP_LABEL[drop.status]}
                    </span>
                  </td>
                  <td>{drop.items.length}</td>
                  <td>{drop.items.reduce((s, i) => s + i.claimed, 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// This week's drop
// ---------------------------------------------------------------------------

function DropCard({
  drop,
  canManage,
  busy,
  onAct,
}: {
  drop: AdminDrop;
  canManage: boolean;
  busy: boolean;
  onAct: (body: Record<string, unknown>, success: string) => Promise<boolean>;
}) {
  return (
    <div className="tka-card tka-scroll">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <h3>
          Drop de la semana del {day(drop.weekStart)}{" "}
          <span className={`tka-pill ${DROP_PILL[drop.status]}`}>{DROP_LABEL[drop.status]}</span>
        </h3>
        {canManage && (
          <div style={{ display: "flex", gap: 8 }}>
            {drop.status !== "open" && (
              <button
                className="tka-btn ok sm"
                disabled={busy || drop.items.length === 0}
                title={drop.items.length === 0 ? "Carga al menos un premio antes de abrir" : undefined}
                onClick={() =>
                  void onAct(
                    { action: "set_drop_status", dropId: drop.id, status: "open" },
                    "Drop abierto: ya se ve en el panel del participante",
                  )
                }
              >
                Abrir Drop
              </button>
            )}
            {drop.status !== "closed" && (
              <button
                className="tka-btn ghost sm"
                disabled={busy}
                onClick={() =>
                  void onAct(
                    { action: "set_drop_status", dropId: drop.id, status: "closed" },
                    "Drop cerrado",
                  )
                }
              >
                Cerrar Drop
              </button>
            )}
          </div>
        )}
      </div>

      <table style={{ marginTop: 12 }}>
        <thead>
          <tr>
            <th>Premio</th>
            <th>Tipo</th>
            <th>Costo</th>
            <th>Inventario</th>
            <th>Canjeados</th>
            <th>Quedan</th>
            {canManage && <th>Acciones</th>}
          </tr>
        </thead>
        <tbody>
          {drop.items.length === 0 && (
            <tr>
              <td colSpan={canManage ? 7 : 6} style={{ color: "#6B665B" }}>
                Este Drop todavía no tiene premios.
              </td>
            </tr>
          )}
          {drop.items.map((item) => (
            <ItemRow key={item.id} item={item} canManage={canManage} busy={busy} onAct={onAct} />
          ))}
        </tbody>
      </table>

      {canManage && <AddItemForm dropId={drop.id} busy={busy} onAct={onAct} />}
    </div>
  );
}

function ItemRow({
  item,
  canManage,
  busy,
  onAct,
}: {
  item: AdminDropItem;
  canManage: boolean;
  busy: boolean;
  onAct: (body: Record<string, unknown>, success: string) => Promise<boolean>;
}) {
  const [cost, setCost] = useState(String(item.pointsCost));
  const [inventory, setInventory] = useState(String(item.inventory));
  const dirty =
    Number(cost) !== item.pointsCost || Number(inventory) !== item.inventory;

  return (
    <tr>
      <td>
        <b>{item.nameEs}</b>
        {item.nameEn && (
          <>
            <br />
            <span style={{ fontSize: 11, color: "#6B665B" }}>{item.nameEn}</span>
          </>
        )}
      </td>
      <td>{KIND_LABEL[item.kind]}</td>
      <td>
        {canManage ? (
          <input
            type="number"
            min={1}
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            style={{ width: 88, fontSize: 12, padding: "5px 8px" }}
          />
        ) : (
          `${item.pointsCost} pts`
        )}
      </td>
      <td>
        {canManage ? (
          <input
            type="number"
            min={0}
            value={inventory}
            onChange={(e) => setInventory(e.target.value)}
            style={{ width: 78, fontSize: 12, padding: "5px 8px" }}
          />
        ) : (
          item.inventory
        )}
      </td>
      <td>{item.claimed}</td>
      <td>
        <b>{item.remaining}</b>
        {item.remaining === 0 && (
          <>
            {" "}
            <span className="tka-pill mute">Agotado</span>
          </>
        )}
      </td>
      {canManage && (
        <td>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button
              className="tka-btn sm"
              disabled={busy || !dirty || !Number.isFinite(Number(cost))}
              onClick={() =>
                void onAct(
                  {
                    action: "update_item",
                    itemId: item.id,
                    pointsCost: Number(cost),
                    inventory: Number(inventory),
                  },
                  `${item.nameEs} actualizado`,
                )
              }
            >
              Guardar
            </button>
            <button
              className="tka-btn ghost sm"
              disabled={busy}
              onClick={() =>
                void onAct(
                  { action: "update_item", itemId: item.id, active: !item.active },
                  item.active ? `${item.nameEs} desactivado` : `${item.nameEs} activado`,
                )
              }
            >
              {item.active ? "Desactivar" : "Activar"}
            </button>
          </div>
        </td>
      )}
    </tr>
  );
}

function AddItemForm({
  dropId,
  busy,
  onAct,
}: {
  dropId: string;
  busy: boolean;
  onAct: (body: Record<string, unknown>, success: string) => Promise<boolean>;
}) {
  const [nameEs, setNameEs] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [kind, setKind] = useState<PrizeKind>("product");
  const [pointsCost, setPointsCost] = useState("1000");
  const [inventory, setInventory] = useState("5");

  const submit = async () => {
    const ok = await onAct(
      {
        action: "add_item",
        dropId,
        nameEs: nameEs.trim(),
        nameEn: nameEn.trim() || null,
        kind,
        pointsCost: Number(pointsCost),
        inventory: Number(inventory),
      },
      `${nameEs.trim()} agregado al Drop`,
    );
    if (ok) {
      setNameEs("");
      setNameEn("");
    }
  };

  const valid =
    nameEs.trim().length > 0 &&
    Number(pointsCost) > 0 &&
    Number.isInteger(Number(pointsCost)) &&
    Number(inventory) >= 0 &&
    Number.isInteger(Number(inventory));

  return (
    <>
      <h3 style={{ marginTop: 18 }}>Agregar premio</h3>
      <p className="tka-note">
        El nombre en inglés es opcional: una campaña de un solo idioma no debe inventarse una
        traducción que nadie escribió.
      </p>
      <div className="tka-form">
        <label>
          Nombre (español)
          <input
            type="text"
            value={nameEs}
            onChange={(e) => setNameEs(e.target.value)}
            placeholder="Garrafón 19 L gratis"
          />
        </label>
        <label>
          Nombre (inglés, opcional)
          <input
            type="text"
            value={nameEn}
            onChange={(e) => setNameEn(e.target.value)}
            placeholder="Free 19 L water jug"
          />
        </label>
        <label>
          Tipo
          <select value={kind} onChange={(e) => setKind(e.target.value as PrizeKind)}>
            {PRIZE_KINDS.map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Costo en puntos
          <input
            type="number"
            min={1}
            value={pointsCost}
            onChange={(e) => setPointsCost(e.target.value)}
          />
        </label>
        <label>
          Inventario de la semana
          <input
            type="number"
            min={0}
            value={inventory}
            onChange={(e) => setInventory(e.target.value)}
          />
        </label>
      </div>
      <button
        className="tka-btn"
        style={{ marginTop: 12 }}
        disabled={busy || !valid}
        onClick={() => void submit()}
      >
        + Agregar al Drop
      </button>
    </>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { pickableStates } from "@/lib/tickets/states";
import { useTickets } from "../TicketsShell";
import { useMe, type MeProfile } from "../useMe";

const ERROR_KEYS: Record<string, "errZip" | "errConsents" | "errState" | "errGeneric"> = {
  bad_zip: "errZip",
  consents_required: "errConsents",
  state_not_eligible: "errState",
};

export default function RegisterPage() {
  const { campaign, t, base } = useTickets();
  const router = useRouter();
  const { status, me, reload } = useMe(campaign.slug);

  useEffect(() => {
    if (status === "anon") router.replace(`${base}entrar/`);
  }, [status, router, base]);

  if (status === "loading" || status === "anon") {
    return <div className="tk-pad"><p className="tk-body">{t("loading")}</p></div>;
  }

  return (
    // Keyed by the profile being edited: React remounts the form with fresh
    // initial state instead of the page mirroring `me` into state through an
    // effect, which is the classic way to end up with a stale form.
    <ProfileForm
      key={me?.participant?.id ?? "new"}
      initial={me?.participant ?? null}
      onSaved={async () => {
        await reload();
        router.replace(`${base}subir/`);
      }}
    />
  );
}

/**
 * Profile plus consent. The three checkboxes become three separate records
 * with the rules version stamped on each — marketing is optional and starts
 * unchecked, which is not a UX preference but the thing that keeps the
 * marketing list defensible.
 */
function ProfileForm({
  initial,
  onSaved,
}: {
  initial: MeProfile | null;
  onSaved: () => Promise<void>;
}) {
  const { campaign, locale, t } = useTickets();

  const [firstName, setFirstName] = useState(initial?.firstName ?? "");
  const [lastName, setLastName] = useState(initial?.lastName ?? "");
  const [alias, setAlias] = useState(initial?.alias ?? "");
  const [zip, setZip] = useState(initial?.zip ?? "");
  const [state, setState] = useState(initial?.state ?? "");
  const [ageState, setAgeState] = useState(false);
  const [rules, setRules] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const states = pickableStates(campaign.eligibleStates);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!firstName.trim() || !lastName.trim() || !state) {
      setError(t("errRequired"));
      return;
    }
    if (alias.trim().length < 2 || alias.trim().length > 20) {
      setError(t("errAlias"));
      return;
    }
    if (!/^\d{5}(-\d{4})?$/.test(zip.trim())) {
      setError(t("errZip"));
      return;
    }
    if (!ageState || !rules) {
      setError(t("errConsents"));
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(`/api/tickets/${campaign.slug}/me/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          alias: alias.trim(),
          zip: zip.trim(),
          state,
          locale,
          acceptedAgeState: true,
          acceptedRules: true,
          acceptedMarketing: marketing,
        }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        setError(t(ERROR_KEYS[payload.error ?? ""] ?? "errGeneric"));
        setBusy(false);
        return;
      }
      await onSaved();
    } catch {
      setError(t("errNetwork"));
      setBusy(false);
    }
  };

  return (
    <div className="tk-pad">
      <div>
        <div className="tk-eyebrow">{t("regStep", { n: 2 })}</div>
        <h1 className="tk-h" style={{ fontSize: 28, marginTop: 6 }}>
          {t("regTitle")}
        </h1>
        <p className="tk-body" style={{ fontSize: 13.5, marginTop: 6 }}>
          {t("regSub")}
        </p>
      </div>

      {error && <p className="tk-error">{error}</p>}

      <form
        className="tk-card"
        style={{ display: "flex", flexDirection: "column", gap: 14 }}
        onSubmit={submit}
      >
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <label className="tk-field">
            {t("fName")}
            <input
              type="text"
              autoComplete="given-name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
            />
          </label>
          <label className="tk-field">
            {t("fLast")}
            <input
              type="text"
              autoComplete="family-name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
            />
          </label>
        </div>

        <label className="tk-field">
          {t("fAlias")}
          <input
            type="text"
            autoComplete="nickname"
            maxLength={20}
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
            required
          />
          <span className="tk-foot" style={{ marginTop: 4 }}>{t("fAliasHint")}</span>
        </label>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <label className="tk-field">
            {t("fZip")}
            <input
              type="text"
              inputMode="numeric"
              autoComplete="postal-code"
              maxLength={10}
              value={zip}
              onChange={(e) => setZip(e.target.value)}
              placeholder="79901"
              required
            />
          </label>
          <label className="tk-field">
            {t("fState")}
            <select value={state} onChange={(e) => setState(e.target.value)} required>
              <option value="">{t("fStatePick")}</option>
              {states.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="tk-check">
          <input
            type="checkbox"
            checked={ageState}
            onChange={(e) => setAgeState(e.target.checked)}
          />
          <span>{t("chkAge")}</span>
        </label>
        <label className="tk-check">
          <input type="checkbox" checked={rules} onChange={(e) => setRules(e.target.checked)} />
          <span>
            {t("chkRules")}
            {campaign.rulesUrl && (
              <>
                {" "}
                <a href={campaign.rulesUrl} target="_blank" rel="noreferrer">
                  {t("rulesLink")}
                </a>
              </>
            )}
          </span>
        </label>
        <label className="tk-check">
          <input
            type="checkbox"
            checked={marketing}
            onChange={(e) => setMarketing(e.target.checked)}
          />
          <span>{t("chkMkt", { org: campaign.orgName })}</span>
        </label>

        <button className="tk-btn" type="submit" disabled={busy}>
          {busy ? t("regSaving") : t("regBtn")} →
        </button>
        <p className="tk-foot">{t("regNote")}</p>
      </form>
    </div>
  );
}

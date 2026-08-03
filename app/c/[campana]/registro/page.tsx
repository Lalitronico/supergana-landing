"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatMxPhone, normalizeMxPhone } from "@/lib/tickets/phone";
import { pickableStates } from "@/lib/tickets/states";
import { useTickets } from "../TicketsShell";
import { useMe, type MeProfile } from "../useMe";

const ERROR_KEYS: Record<
  string,
  "errZip" | "errPhone" | "errConsents" | "errState" | "errGeneric"
> = {
  bad_zip: "errZip",
  bad_phone: "errPhone",
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
 *
 * Which of phone / ZIP / state appear is the campaign's answer, not this
 * file's: `profileFields` comes from `campaigns.config` (see `ProfileFields`).
 * A US promotion is scoped by ZIP and state; a Mexican one delivers a top-up
 * to a phone number and asks for neither.
 */
function ProfileForm({
  initial,
  onSaved,
}: {
  initial: MeProfile | null;
  onSaved: () => Promise<void>;
}) {
  const { campaign, locale, t } = useTickets();

  const fields = campaign.profileFields;
  const asksPhone = fields.phone !== "off";
  const asksZip = fields.zip !== "off";
  const asksState = fields.state !== "off";

  const [firstName, setFirstName] = useState(initial?.firstName ?? "");
  const [lastName, setLastName] = useState(initial?.lastName ?? "");
  const [alias, setAlias] = useState(initial?.alias ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [zip, setZip] = useState(initial?.zip ?? "");
  const [state, setState] = useState(initial?.state ?? "");
  const [ageState, setAgeState] = useState(false);
  const [rules, setRules] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const states = pickableStates(campaign.eligibleStates);

  // Derived every render instead of stored: the field the participant edits is
  // whatever they typed, and the E.164 form is a view of it. Keeping a second
  // piece of state in step with the first is how the two end up disagreeing.
  const phoneE164 = phone.trim() ? normalizeMxPhone(phone) : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!firstName.trim() || !lastName.trim() || (fields.state === "required" && !state)) {
      setError(t("errRequired"));
      return;
    }
    if (alias.trim().length < 2 || alias.trim().length > 20) {
      setError(t("errAlias"));
      return;
    }
    // Empty is only an error where the campaign says the field is required;
    // a value that is present must be well-formed whatever the mode says.
    if (asksZip && (zip.trim() || fields.zip === "required")) {
      if (!/^\d{5}(-\d{4})?$/.test(zip.trim())) {
        setError(t("errZip"));
        return;
      }
    }
    if (asksPhone && (phone.trim() || fields.phone === "required") && !phoneE164) {
      setError(t("errPhone"));
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
          // Always E.164 on the wire. What the person typed never leaves the
          // browser: the number is how a prize gets delivered, and two
          // spellings of it are two people as far as any operator can tell.
          phone: asksPhone ? phoneE164 : null,
          zip: asksZip ? zip.trim() : null,
          state: asksState ? state : null,
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
          {t(campaign.mechanic === "accumulation" ? "accRegSub" : "regSub")}
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

        {asksPhone && (
          <label className="tk-field">
            {t("fPhone")}
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              maxLength={20}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="656 111 2233"
              required={fields.phone === "required"}
            />
            {/* The normalised number, before anything is saved. The participant
                types it their way and confirms ours — the only moment a typo in
                the field that receives the prize can still be caught. */}
            <span className="tk-foot" style={{ marginTop: 4 }}>
              {phoneE164
                ? t("fPhonePreview", { phone: formatMxPhone(phoneE164) })
                : t("fPhoneHint")}
            </span>
          </label>
        )}

        {(asksZip || asksState) && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: asksZip && asksState ? "1fr 1fr" : "1fr",
              gap: 12,
            }}
          >
            {asksZip && (
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
                  required={fields.zip === "required"}
                />
              </label>
            )}
            {asksState && (
              <label className="tk-field">
                {t("fState")}
                <select
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  required={fields.state === "required"}
                >
                  <option value="">{t("fStatePick")}</option>
                  {states.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        )}

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

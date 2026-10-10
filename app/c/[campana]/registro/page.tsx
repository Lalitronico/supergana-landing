"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatMxPhone, normalizeMxPhone } from "@/lib/platform/phone";
import { pickableStates } from "@/lib/tickets/states";
import { useSession, useTickets } from "../TicketsShell";
import { Headline } from "../Headline";
import { EntryHead } from "../showcase/EntryHead";
import type { MeProfile } from "../useMe";

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
  const { t, base } = useTickets();
  const router = useRouter();
  const { status, me, reload } = useSession();

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
      accountPhone={me?.phone ?? null}
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
  accountPhone,
  onSaved,
}: {
  initial: MeProfile | null;
  /** The number the session was opened with, on phone campaigns. Shown, never
   *  edited — see where it is rendered. */
  accountPhone: string | null;
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
  // The nickname is the field people stall on. Until they touch it, it follows
  // their first name (a valid 2-20 char default they can overwrite), so the
  // common case is one fewer thing to invent in a hurry.
  const [aliasEdited, setAliasEdited] = useState(Boolean(initial?.alias));
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
      <EntryHead
        step={2}
        title={<Headline text={t("regTitle")} mark={t("regTitleMark")} as="brand" />}
        sub={t(campaign.mechanic === "accumulation" ? "accRegSub" : "regSub")}
      />

      {error && <p className="tk-error">{error}</p>}

      <form
        className="tk-card sh-form"
        onSubmit={submit}
      >
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <label className="tk-field">
            {t("fName")}
            <input
              type="text"
              autoComplete="given-name"
              autoCapitalize="words"
              enterKeyHint="next"
              autoFocus
              value={firstName}
              onChange={(e) => {
                setFirstName(e.target.value);
                if (!aliasEdited) setAlias(e.target.value.trim().slice(0, 20));
              }}
              required
            />
          </label>
          <label className="tk-field">
            {t("fLast")}
            <input
              type="text"
              autoComplete="family-name"
              autoCapitalize="words"
              enterKeyHint="next"
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
            onChange={(e) => {
              setAliasEdited(true);
              setAlias(e.target.value);
            }}
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

        {/* The number that opened the session, shown and not asked for.
            `profileFields.phone` is forced to "off" on these campaigns
            (parseCampaignConfig) and the server writes the phone from the
            session regardless — so the box would be a lie in two directions:
            it could not change anything, and it would suggest it could. Shown
            anyway because somebody filling in a profile deserves to see which
            number their points are about to hang on. */}
        {campaign.authChannel === "phone" && accountPhone && (
          <div className="tk-field">
            {t("fPhone")}
            <p className="tk-body" style={{ fontWeight: 700, marginTop: 4 }}>
              {formatMxPhone(accountPhone)}
            </p>
            <span className="tk-foot" style={{ marginTop: 4 }}>{t("fPhoneProven")}</span>
          </div>
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

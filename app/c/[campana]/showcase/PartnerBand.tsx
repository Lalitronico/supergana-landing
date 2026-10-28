"use client";

import { useId, type CSSProperties } from "react";
import type { Partner } from "@/lib/tickets/config";
import { useTickets } from "../TicketsShell";
import { SafeImg } from "./SafeImg";

function PartnerRow({ label, partners, step }: { label: string; partners: Partner[]; step: number }) {
  const labelId = useId();
  if (partners.length === 0) return null;

  return (
    <div className="sh-partners-row sh-rise" style={{ "--i": step } as CSSProperties}>
      <p className="sh-partners-label" id={labelId}>
        {label}
      </p>
      <ul aria-labelledby={labelId}>
        {partners.map((partner) => {
          const name = <span className="sh-partners-name">{partner.name}</span>;
          return (
            <li key={partner.name}>
              {partner.logoUrl ? (
                <SafeImg src={partner.logoUrl} alt={partner.name} fallback={name} />
              ) : (
                name
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Who runs the promotion with the sponsor, and where: the brands row and the
 * stores row of `config.partners`, as logo cards on a paper band right under
 * the hero's kerb. Renders nothing for a campaign that names no partners.
 */
export function PartnerBand() {
  const { campaign, t } = useTickets();
  const { brands, stores } = campaign.partners;
  if (brands.length === 0 && stores.length === 0) return null;

  return (
    <section className="sh-sec sh-partners">
      <PartnerRow label={t("shPartnersBrands")} partners={brands} step={1} />
      <PartnerRow label={t("shPartnersStores")} partners={stores} step={2} />
    </section>
  );
}

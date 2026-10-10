-- Ticket al Tanque demo: delivery copy that is true per prize and exists in
-- both languages.
--
-- 0033 wrote `entrega` in Spanish only, so the English screens printed it in
-- Spanish, and the free Jarritos said "cupón digital" for what is a pick-up at
-- the register. `prizeDetail` (lib/tickets/store.ts) reads `entrega` and
-- `entrega_en`.
update public.prize_drop_items i
   set detail = i.detail || case
         when i.kind = 'product' then jsonb_build_object(
           'entrega',    'Muestra este código en la caja de una tienda participante y llévate tu Jarritos 1.5 L.',
           'entrega_en', 'Show this code at the register of a participating store and take your Jarritos 1.5 L home.')
         else jsonb_build_object(
           'entrega',    'Te llega por correo, vía Tremendous, en cuanto confirmamos tu canje.',
           'entrega_en', 'It arrives by email, via Tremendous, as soon as we confirm your redemption.')
       end
  from public.prize_drops d
  join public.campaigns c on c.id = d.campaign_id
 where d.id = i.drop_id
   and c.slug = 'tanque';

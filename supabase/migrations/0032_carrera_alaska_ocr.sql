-- Carrera Alaska reads its own receipts — written down at last
-- ===========================================================================
--
-- The OCR shipped on 2026-08-05 and has been reading and auto-approving in
-- production ever since. The CODE for it is all in the repository; the
-- CONFIGURATION that turns it on is not. It was applied by hand with an
-- `update` and lives only in the production database.
--
-- That is a quiet kind of debt. Rebuild this project from its migrations —
-- a staging copy, a restore, a second tenant modelled on this one — and you get
-- a campaign whose receipts nobody reads, with no error and no warning, because
-- every one of these keys fails closed by design (`asOcr` in
-- lib/tickets/config.ts requires `enabled` before it will honour `autofill`,
-- and `enabled` again before `auto_approve`). The rebuild would look fine and
-- silently send every receipt to a human.
--
-- So this states the live configuration, which is the one the OCR brief
-- documents and the one the auto-approval tests are written against.
--
-- IT IS NOT A SWITCH. Turning the reading off stays what it always was — one
-- `update`, no deploy, no migration:
--
--     update public.campaigns
--        set config = jsonb_set(config, '{ocr,auto_approve}', 'false'::jsonb)
--      where slug = 'carrera-alaska';
--
-- Written with `||` so it merges rather than replaces, and so re-running it is
-- a no-op against a database that already agrees. Only Alaska: Ticket al Tanque
-- carries no `ocr` key at all, which is how it gets the safe defaults, and
-- reading a tenant's receipts with a third party has to be asked for by name.
update public.campaigns
   set config = config || jsonb_build_object(
         'ocr', jsonb_build_object(
           -- Reads every receipt as it arrives.
           'enabled',      true,
           -- Pre-fills the reviewer's form, but only a pristine one: a single
           -- keystroke by a human makes the form theirs (ReviewPanel.tsx).
           'autofill',     true,
           -- Settles the clean ones without a reviewer. Never rejects: the
           -- three outcomes are approve, ask for a better photo, or queue.
           'auto_approve', true,
           -- Pinned deliberately. A model swap changes what gets approved
           -- without a human, so it is a decision with a date on it, not a
           -- default that drifts when a provider renames something.
           'model',        'qwen3.8-max'
         ),
         -- A line counts when it names the brand, rather than matching a SKU
         -- in the dictionary. Alaska sells water under one brand and did not
         -- want a per-SKU dictionary maintained; Novamex is the opposite case
         -- and stays on 'sku'.
         'eligibility', 'brand'
       )
 where slug = 'carrera-alaska';

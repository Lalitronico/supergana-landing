-- Ticket al Tanque demo: read receipts with qwen3.5-plus instead of qwen3.8-max.
--
-- Measured 2026-10-10 with scripts/probes/read-receipt.mjs (the app's own
-- extractReceipt + decideAutomatically, same prompt, same catalogue):
--   qwen3.8-max   →  8/22 approve; the rest queue on `issues: suspicious_text`
--                    with every field read correctly. It also flags the Alaska
--                    receipt it approved in August — the model drifted, the
--                    prompt (lib/tickets/ocr.ts rule 4) already says the issue
--                    is ONLY for printed instructions.
--   qwen3.5-plus  → 22/22 approve with exact store/date/total/eligible, three
--                    consecutive runs, plus 4/4 simulated phone photos;
--                    same 7–10 s latency.
-- Per-campaign key on purpose: Carrera Alaska keeps its model until it is
-- re-measured on its own receipts.
update public.campaigns
   set config = jsonb_set(config, '{ocr,model}', '"qwen3.5-plus"')
 where slug = 'tanque'
   and module = 'tickets';

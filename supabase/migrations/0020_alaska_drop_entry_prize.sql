-- A reachable first rung on Carrera Alaska's prize ladder.
--
-- WHY THIS EXISTS
--
-- The open Drop's cheapest prize costs 1000 points, and at 10 points per peso
-- that is $100 of eligible spend. A garrafón is about $11.50, so one real receipt
-- earns ~115 points and somebody would need nine of them before anything is
-- claimable. In a demo that means the whole second half of the mechanic — the
-- confirmation, the golden ticket, the code read out at a counter — is
-- unreachable, and in production it means a convenience-store shopper's first
-- reward is very far away.
--
-- 100 points = $10 of eligible spend = roughly one garrafón. That is a real entry
-- prize, not a demo trick: the cheapest thing in Alaska's own catalogue, priced so
-- the first purchase already earns it.
--
-- STILL A PLACEHOLDER
--
-- `placeholder: true` like every other item in this Drop. Questions 6 and 7 of
-- Alaska/PREGUNTAS_ABIERTAS.md are still open — which prizes the client actually
-- wants, and what may be spent per week — and the whole ladder gets repriced when
-- they land. What this migration settles is that the ladder needs a bottom rung,
-- which is a design point worth keeping whatever the client answers.
--
-- Priced against the catalogue's own products (Botella 1 L exists in `products`),
-- so the reward is something Alaska already sells rather than something invented.
--
-- Keyed on the open Drop rather than an id, since ids are generated.

INSERT INTO prize_drop_items (drop_id, name_es, name_en, kind, points_cost, inventory, detail, active)
SELECT d.id,
       'Botella 1 L gratis',
       'Free 1 L bottle',
       'product',
       100,
       20,
       jsonb_build_object(
         'entrega', 'Se recoge en tienda participante mostrando el código de canje.',
         'placeholder', true,
         'nota', 'Primer escalón de la escalera: 100 pts = $10 elegibles ≈ un garrafón, para que la primera compra ya alcance algo. Reprecificar con las respuestas 6 y 7 de PREGUNTAS_ABIERTAS.'
       ),
       true
FROM prize_drops d
JOIN campaigns c ON c.id = d.campaign_id
WHERE c.slug = 'carrera-alaska'
  AND c.module = 'tickets'
  AND d.status = 'open'
  -- Idempotent: re-running must not stack a second bottle onto the same Drop.
  AND NOT EXISTS (
    SELECT 1 FROM prize_drop_items existing
    WHERE existing.drop_id = d.id
      AND existing.name_es = 'Botella 1 L gratis'
  );

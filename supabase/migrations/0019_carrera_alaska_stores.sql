-- The two participating stores Eduardo named, so the console stops suggesting
-- another client's retailer to a reviewer reading a Ciudad Juárez receipt.
--
-- THIS LIST IS INCOMPLETE, ON PURPOSE
--
-- Eduardo said "tiendas de conveniencia superette y del río, etc." — the "etc."
-- is the part nobody can invent. Only these two are seeded; the rest arrive with
-- question 3 of Alaska/PREGUNTAS_ABIERTAS.md, which asks for the name and branch
-- **as they print on the ticket**, because that is what the reviewer copies and
-- what the anti-duplicate lock compares.
--
-- The spelling matters more than it looks. The lock is (store + date + total), so
-- "Superette" and "SUPERETTE #12" are two different shops as far as it can tell,
-- and one receipt claimed twice slips through between them. That is why the
-- config asks for how the store PRINTS, not how the brand is written on its sign.
--
-- The field stays free text with these as suggestions, not a closed dropdown: the
-- reviewer still has to add the branch number, and a store missing from the list
-- must not block a real receipt on a Saturday afternoon.
--
-- What the console does with this, now that it has it:
--   · offers the list under the store box (datalist)
--   · uses the first entry as the placeholder — it used to read
--     "El Super #114 · El Paso, TX"
--   · prints the list under "Reglas vigentes", and says "sin capturar" when a
--     campaign has none, since an unlisted store is a real gap

UPDATE campaigns
SET config = config || jsonb_build_object('stores', jsonb_build_array(
  'Superette',
  'Del Río'
))
WHERE slug = 'carrera-alaska'
  AND module = 'tickets';

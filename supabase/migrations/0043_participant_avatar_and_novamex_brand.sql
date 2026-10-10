-- Two changes for the Ticket al Tanque demo round 2.
--
-- 1. participants.avatar — the Supergana character a participant picks as
--    themselves ("elige tu personaje"). It is shown next to their alias on the
--    leaderboard, the panel and the room's live screen. Nullable and additive:
--    campaigns whose org theme has no cast never ask, and old code ignores it.
--    The value is a cast id from organizations.theme.cast; the API validates it
--    against the campaign's theme, the check here only bounds the shape.
alter table public.participants add column if not exists avatar text;
alter table public.participants drop constraint if exists participants_avatar_shape;
alter table public.participants add constraint participants_avatar_shape
  check (avatar is null or avatar ~ '^[a-z0-9-]{1,32}$');

-- 2. Novamex identity colour back to Novamex. #FD5000 was Jarritos orange,
--    and Jarritos is out of this demo (0042). Novamex's own yellow #FFB900 is
--    too light for text on cream (1.61:1), so the shell draws a light brand as
--    a marker highlight under ink text instead of as coloured text (Supergana's
--    own emphasis style); brand_ink #7A5200 (6.47:1 on cream) is for small text.
update public.organizations
   set theme = theme || jsonb_build_object(
         'brand', '#FFB900',
         'brand_ink', '#7A5200',
         'note', 'Placeholder hasta recibir brand kit. Logo oficial de novamex.com; brand = amarillo Novamex, dibujado como marcador bajo texto tinta.'
       )
 where slug = 'novamex';

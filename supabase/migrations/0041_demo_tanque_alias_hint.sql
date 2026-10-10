-- Ticket al Tanque demo: tell people where their nickname will appear.
-- In the meeting the nickname is projected on the live screen; saying so at the
-- moment they choose it is what makes them pick a name the room will recognise.
update public.campaigns
   set config = jsonb_set(jsonb_set(config,
         '{copy,es,fAliasHint}', '"Así aparecerás en el ranking y en la pantalla en vivo."'),
         '{copy,en,fAliasHint}', '"This is how you''ll show up on the leaderboard and the live screen."')
 where slug = 'tanque'
   and module = 'tickets';

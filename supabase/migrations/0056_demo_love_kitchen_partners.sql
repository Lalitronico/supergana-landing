-- Love & Kitchen demo: the companies the promotion runs with, on the home.
--
-- Bafar's review (2026-10-27/28): put Bachi beside Love & Kitchen as the two
-- brands, and La Pastora and CarneMart as the stores, on the home only.
-- `config.partners` draws them as a paper band of logo cards under the hero.
--
-- Love & Kitchen goes in as its monogram (the brand's own, from
-- loveandkitchen.com): the full wordmark is already in the header, and at
-- 7.7:1 it would shrink to a thread in a card beside Bachi's leaf.
--
-- Safe in either order with the deploy: a build without the partner band
-- ignores the key.
update public.campaigns
   set config = jsonb_set(
         config,
         '{partners}',
         '{
            "brands": [
              { "name": "Love & Kitchen", "logo_url": "/brands/love-kitchen/monograma.png" },
              { "name": "Bachi", "logo_url": "/brands/bafar/partners/bachi.png" }
            ],
            "stores": [
              { "name": "La Pastora", "logo_url": "/brands/bafar/partners/la-pastora.png" },
              { "name": "CarneMart", "logo_url": "/brands/bafar/partners/carnemart.png" }
            ]
          }'::jsonb,
         true
       )
 where slug = 'love-kitchen'
   and module = 'tickets';

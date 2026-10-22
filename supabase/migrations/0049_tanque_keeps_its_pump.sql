-- Ticket al Tanque keeps its look while the platform stops assuming it.
--
-- Until now two pieces of the Novamex demo lived in code as everybody's
-- default: the fuel pump standing in the middle of every home's hero stage
-- (HeroStage.tsx) and the fuel wording of the progress card ("Tu tanque",
-- "tarjeta de gasolina", "¡Tanque lleno!") in the copy dictionary. A second
-- tickets tenant (Love & Kitchen, 0050) made the leak visible: a sauce brand's
-- home would have stood its cast around a gas pump.
--
-- The code now asks for both by data — `config.stage.prop = "pump"` and
-- `config.copy` — and its defaults are neutral. This migration writes into
-- `tanque` exactly what it used to get by default, so the Novamex demo renders
-- the same on the new code. Additive only: the old deploy that the
-- supergana-demo.vercel.app alias points to ignores `stage`, and the copy keys
-- below already existed there with these same strings.

update public.campaigns
   set config = config
       || jsonb_build_object('stage', jsonb_build_object('prop', 'pump', 'backdrop', 'blue'))
       || jsonb_build_object('copy', jsonb_build_object(
            'es', coalesce(config -> 'copy' -> 'es', '{}'::jsonb) || jsonb_build_object(
              'jrFuelEyebrow',     'Tu tanque',
              'jrFuelMissingGift', 'Te faltan {points} pts para tu tarjeta de gasolina de {value}',
              'jrFuelReadyGift',   '¡Tanque lleno! Tu tarjeta de gasolina de {value} ya es tuya',
              'jrFuelReadyItem',   '¡Tanque lleno! Ya puedes canjear {name}',
              'jrFuelNextGift',    'Siguiente meta: tarjeta de gasolina de {value} · te faltan {points} pts',
              'jrReadInReview',    'Lo está revisando una persona. Te avisamos en menos de {hours} horas; tu tanque se llena en cuanto lo aprueben.'
            ),
            'en', coalesce(config -> 'copy' -> 'en', '{}'::jsonb) || jsonb_build_object(
              'jrFuelEyebrow',   'Your tank',
              'jrFuelReadyGift', 'Tank full! Your {value} gift card is yours',
              'jrFuelReadyItem', 'Tank full! You can redeem {name} now',
              'jrReadInReview',  'A person is reviewing it. We''ll let you know within {hours} hours; your tank fills the moment it''s approved.'
            )
          ))
 where slug = 'tanque'
   and module = 'tickets';

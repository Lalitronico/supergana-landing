-- Drop de ensayo de la Tienda de Premios para `carrera-alaska`.
--
-- TODO EL CONTENIDO DE ESTE ARCHIVO ES INVENCIÓN PARA EL MODO ENSAYO.
--
-- Ni los premios, ni los precios en puntos, ni los inventarios vienen del
-- cliente: el Drop real sale de las respuestas #6 y #7 de Agua Alaska, que a la
-- fecha de esta migración no han llegado (ver 0012_seed_carrera_alaska.sql y
-- alaska-gaps.md). Existe para que el equipo pueda caminar el flujo completo
-- —ver premio, canjear, leer el código, marcarlo entregado— antes de que la
-- campaña se publique. Cuando lleguen las respuestas: cerrar este drop desde la
-- consola y crear el de verdad ahí mismo, no editando este archivo.
--
-- La semana del drop se calcula al aplicar la migración: `tickets_week_start`
-- devuelve el lunes 00:00 de la plaza de la campaña ('America/Ciudad_Juarez',
-- también placeholder). Consecuencia deliberada: si esto se aplica un jueves,
-- el drop vive hasta el domingo y el lunes siguiente la RPC lo rechaza aunque
-- siga 'open' —el status es curaduría, el reloj lo pone tickets_week_start—.
-- Para el ensayo de la semana siguiente se crea un drop nuevo desde la consola.
--
-- status 'open' y no 'scheduled' porque un ensayo que hay que abrir a mano
-- antes de poder probar nada no es un ensayo, es un segundo pendiente.

insert into public.prize_drops (campaign_id, week_start, status)
select
  c.id,
  public.tickets_week_start(coalesce(c.config ->> 'timezone', 'America/Ciudad_Juarez')),
  'open'
from public.campaigns c
where c.slug = 'carrera-alaska'
on conflict (campaign_id, week_start) do nothing;

-- Los tres premios cubren a propósito las tres formas de entrega que el módulo
-- tiene que saber distinguir: recarga digital (llega al celular, operación
-- manual), producto de la marca (se recoge en tienda con el código) y artículo
-- promocional (mismo canje, otro almacén). Los costos en puntos están puestos
-- contra el catálogo real de precios que sí conocemos —$1 = 10 pts, un garrafón
-- de 19 L son 515 pts de compra— así que "1000 pts por un garrafón" equivale a
-- dos garrafones comprados. Es una relación plausible para ensayar, no una
-- decisión de negocio.
insert into public.prize_drop_items (drop_id, name_es, name_en, kind, points_cost, inventory, detail)
select
  d.id, v.name_es, v.name_en, v.kind, v.points_cost, v.inventory, v.detail
from public.prize_drops d
join public.campaigns c on c.id = d.campaign_id
cross join (
  values
    (
      'Recarga telefónica $50'::text,
      'Phone top-up $50'::text,
      'recharge'::text,
      1500,
      5,
      jsonb_build_object(
        'placeholder', true,
        'denominacion_mxn', 50,
        'entrega', 'Manual: el equipo hace la recarga al número registrado.'
      )
    ),
    (
      'Garrafón 19 L gratis',
      'Free 19 L water jug',
      'product',
      1000,
      10,
      jsonb_build_object(
        'placeholder', true,
        'entrega', 'Se recoge en tienda participante mostrando el código de canje.'
      )
    ),
    (
      'Termo Alaska',
      'Alaska thermos',
      'item',
      3000,
      3,
      jsonb_build_object(
        'placeholder', true,
        'entrega', 'Se recoge en tienda participante mostrando el código de canje.'
      )
    )
) as v(name_es, name_en, kind, points_cost, inventory, detail)
where c.slug = 'carrera-alaska'
  and d.week_start = public.tickets_week_start(
    coalesce(c.config ->> 'timezone', 'America/Ciudad_Juarez')
  )
  -- Idempotente por nombre dentro del drop: re-aplicar la migración no duplica
  -- inventario, y duplicar inventario es repartir premios que no existen.
  and not exists (
    select 1 from public.prize_drop_items i
    where i.drop_id = d.id and i.name_es = v.name_es
  );

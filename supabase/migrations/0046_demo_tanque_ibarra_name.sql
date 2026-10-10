-- "Chocolate Ibarra Chocolate de mesa" printed the word twice on every chip.
-- The product is the table-chocolate tablet; the label now reads
-- "Chocolate Ibarra Tablillas de mesa". Aliases hang off the product id, so
-- receipt matching is unchanged.
update public.products p
   set name = 'Tablillas de mesa'
  from public.campaigns c
 where c.id = p.campaign_id and c.slug = 'tanque'
   and p.brand = 'Chocolate Ibarra' and p.name = 'Chocolate de mesa';

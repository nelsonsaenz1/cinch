begin;

create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email)
values ('61616161-6161-4161-8161-616161616161', 'wear-owner@example.test'),
       ('62626262-6262-4262-8262-626262626262', 'wear-stranger@example.test');

insert into public.items (id, user_id, category)
values ('63636363-6363-4363-8363-636363636363',
        '61616161-6161-4161-8161-616161616161', 'top');

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"61616161-6161-4161-8161-616161616161","role":"authenticated"}',
  true
);

select lives_ok(
  $$select public.wear_outfit_tx(
      '64646464-6464-4464-8464-646464646464',
      array['63636363-6363-4363-8363-636363636363']::uuid[],
      'Quiet Layers', null, null, 'ai', null, null, 5, true
    )$$,
  'an owner can atomically log a rated favorite wear'
);

select is(
  (select wear_rating from public.outfits where name = 'Quiet Layers'),
  5::smallint,
  'the optional 1-5 rating is stored on the wear'
);
select isnt(
  (select favorited_at from public.outfits where name = 'Quiet Layers'),
  null,
  'the favorite timestamp is stored on the wear'
);
select is(
  (select wear_count from public.items where id = '63636363-6363-4363-8363-636363636363'),
  1,
  'logging the wear increments the garment exactly once'
);

select lives_ok(
  $$select public.wear_outfit_tx(
      '64646464-6464-4464-8464-646464646464',
      array['63636363-6363-4363-8363-636363636363']::uuid[],
      'Quiet Layers', null, null, 'ai', null, null, 5, true
    )$$,
  'retrying the same operation is safe'
);
select is(
  (select count(*)::int from public.outfits where name = 'Quiet Layers'),
  1,
  'an idempotent retry does not create a second wear'
);

reset role;
select throws_ok(
  $$insert into public.outfits (user_id, wear_rating)
    values ('61616161-6161-4161-8161-616161616161', 0)$$,
  '23514',
  null,
  'zero is not a rating'
);

select hasnt_column(
  'public',
  'public_outfits',
  'favorited_at',
  'favorite state is absent from the public outfit projection'
);

select * from finish();
rollback;

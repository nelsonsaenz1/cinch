alter table public.profiles
  add column if not exists style_goals text[] not null default '{}',
  add column if not exists style_adventure text;

comment on column public.profiles.style_goals is
  'Closed-vocabulary priorities selected in the private lifestyle questionnaire.';

comment on column public.profiles.style_adventure is
  'Closed-vocabulary preference for familiar, balanced, or adventurous recommendations.';

-- 계수의 첫 값. apps/mobile 의 번들 기본값(src/engine/defaults.ts)에서 만든 파일이다.
-- 손으로 고치지 말고 `pnpm seed:coefficients` 로 다시 만든다. 운영 중의 조정은 대시보드에서 한다.
insert into public.coefficients (key, value) values
  ('version', '1'::jsonb),
  ('base_interval', '{"succulent":14,"tropical":7,"temperate":6,"herb":3,"bonsai_conifer":2,"bonsai_deciduous":1.5}'::jsonb),
  ('season', '{"succulent":{"spring":1,"monsoon":1.5,"heat":1.2,"autumn":1,"winter":2.5},"tropical":{"spring":1,"monsoon":1.3,"heat":0.7,"autumn":1,"winter":1.6},"temperate":{"spring":1,"monsoon":1.3,"heat":0.7,"autumn":1,"winter":1.8},"herb":{"spring":1,"monsoon":1.2,"heat":0.5,"autumn":1,"winter":1.5},"bonsai_conifer":{"spring":1,"monsoon":1.3,"heat":0.5,"autumn":1,"winter":1.5},"bonsai_deciduous":{"spring":1,"monsoon":1.2,"heat":0.5,"autumn":1,"winter":2}}'::jsonb),
  ('pot', '{"s":0.7,"m":1,"l":1.3,"xl":1.6}'::jsonb),
  ('light', '{"high":0.8,"medium":1,"low":1.3,"very_low":1.6}'::jsonb),
  ('space_type', '{"indoor_window":1,"indoor_far":1,"balcony_ext":0.9,"terrace":0.7}'::jsonb),
  ('soil', '{"potting":1,"gritty":0.8,"akadama":0.6}'::jsonb),
  ('hydro_fixed_days', '7'::jsonb),
  ('interval_clamp', '{"min":1,"max":60}'::jsonb),
  ('learning', '{"initial":1,"min":0.5,"max":2,"soil_state":{"wet":1.15,"ok":1,"dry":0.85},"leaf_droop":0.9,"streak_notice":3}'::jsonb),
  ('max_postpones', '3'::jsonb),
  ('season_bounds', '{"spring":{"month":3,"day":1},"monsoon":{"month":6,"day":21},"heat":{"month":7,"day":26},"autumn":{"month":9,"day":1},"winter":{"month":11,"day":16}}'::jsonb),
  ('diagnose_daily_limit', '3'::jsonb),
  ('daily_cap_identify', '450'::jsonb),
  ('daily_cap_light_grade', '300'::jsonb),
  ('daily_cap_diagnose', '200'::jsonb),
  ('daily_cap_species', '100'::jsonb),
  ('weather_cache_hours', '3'::jsonb)
on conflict (key) do nothing;

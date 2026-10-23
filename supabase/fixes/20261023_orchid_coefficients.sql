-- 식물군에 난초·공중식물(orchid)을 더한 뒤의 계수 (SPEC 5.1, 5.2, 태스크 10-1).
-- 운영 테이블에는 이미 행이 있어 seed 의 on conflict do nothing 으로는 안 바뀌므로 값을 덮어쓴다.
-- 앱은 orchid 가 빠진 표를 받으면 통째로 버리고 번들 기본값을 쓰므로, 이 파일을 적용하기 전에도 돌아간다.
insert into public.coefficients (key, value) values
  ('base_interval', '{"succulent":14,"tropical":7,"temperate":6,"herb":3,"orchid":10,"bonsai_conifer":2,"bonsai_deciduous":1.5}'::jsonb),
  ('season', '{"succulent":{"spring":1,"monsoon":1.5,"heat":1.2,"autumn":1,"winter":2.5},"tropical":{"spring":1,"monsoon":1.3,"heat":0.7,"autumn":1,"winter":1.6},"temperate":{"spring":1,"monsoon":1.3,"heat":0.7,"autumn":1,"winter":1.8},"herb":{"spring":1,"monsoon":1.2,"heat":0.5,"autumn":1,"winter":1.5},"orchid":{"spring":1,"monsoon":1.3,"heat":0.9,"autumn":1,"winter":1.5},"bonsai_conifer":{"spring":1,"monsoon":1.3,"heat":0.5,"autumn":1,"winter":1.5},"bonsai_deciduous":{"spring":1,"monsoon":1.2,"heat":0.5,"autumn":1,"winter":2}}'::jsonb)
on conflict (key) do update set value = excluded.value;

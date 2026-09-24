-- 종 DB 검수 (SPEC.md 10.4 주 1회 검수). 운영 DB 에 한 번 적용한 데이터 수정이다.
-- 여러 번 돌려도 결과가 같다. 적용: npx supabase db query --linked -f supabase/fixes/20260924_species_review.sql

-- 1. 규칙을 좁히기 전에 분재로 만들어진 종을 온대 수목으로 되돌린다 (10.2 매핑 규칙이 이름을 들어 분재가 아니라고 한 것).
--    주기는 일반 화분 기준 그대로 둔다. 분재로 키우면 앱이 분재군 기본값을 쓴다.
update public.species
set group_code = 'temperate', bonsai_group = null, bonsai_tasks = '[]'::jsonb
where scientific_name in ('Buxus microphylla', 'Euonymus japonicus', 'Punica granatum')
  and group_code like 'bonsai%';

-- 2. 분재 수종의 종별 주기를 비운다. 생성 프롬프트가 모든 종을 13~20cm 화분 기준으로 적게 해서
--    분재에도 정원수 기준 4~10일이 들어갔다. 분재 화분은 흙이 빨리 말라 분재군 기본값
--    (침엽 2일, 잡목 1.5일, SPEC 5.1)을 쓴다. 앱에 들어 있는 30종과 같은 방식이다.
update public.species
set base_interval = null
where group_code like 'bonsai%'
  and base_interval > 3;

-- 3. 국명이 틀린 종. 다른 식물의 이름이 붙어 있어 검색에서 잘못 고르게 된다.
update public.species set name_ko = '러브체인', aliases_ko = array['하트체인']
where scientific_name = 'Ceropegia woodii' and name_ko = '하트호야';

update public.species set name_ko = '풀명자', aliases_ko = array['애기명자']
where scientific_name = 'Chaenomeles japonica' and name_ko = '명자나무';

update public.species set name_ko = '마누카', aliases_ko = array['뉴질랜드 티트리']
where scientific_name = 'Leptospermum scoparium' and name_ko = '티트리';

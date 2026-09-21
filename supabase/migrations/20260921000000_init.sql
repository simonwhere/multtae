-- 물때 서버 테이블 (SPEC.md 10.1, 11.2).
-- 서버에는 종 DB 와 계수, 한도 카운터처럼 모두에게 같은 값만 둔다.
-- 사용자 사진·식물·공간 데이터를 담는 테이블은 만들지 않는다 (CLAUDE.md 절대 규칙).
-- 모든 테이블에 RLS 를 켠다. 정책이 없는 테이블은 Edge Function(service role)만 쓴다.

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 10.1 종 DB. 앱은 읽기만 하고, 새 종은 Edge Function 이 만들어 넣는다
create table public.species (
  scientific_name text primary key,
  name_ko text not null,
  aliases_ko text[] not null default '{}',
  group_code text not null check (
    group_code in ('succulent', 'tropical', 'temperate', 'herb', 'bonsai_conifer', 'bonsai_deciduous')
  ),
  base_interval numeric check (base_interval is null or (base_interval > 0 and base_interval <= 60)),
  bonsai_group text check (bonsai_group is null or bonsai_group in ('conifer', 'deciduous', 'flowering')),
  bonsai_tasks jsonb not null default '[]',
  care jsonb not null default '{}',
  fertilizer jsonb,
  repot_months int check (repot_months is null or repot_months > 0),
  repot_season int[] not null default '{}',
  toxic_pet boolean,
  winter_indoor_ok boolean,
  source text not null check (source in ('seed', 'generated')),
  reviewed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index species_name_ko_idx on public.species (name_ko);
create index species_aliases_ko_idx on public.species using gin (aliases_ko);

create trigger species_touch_updated_at
before update on public.species
for each row execute function public.touch_updated_at();

alter table public.species enable row level security;
create policy "species: 누구나 읽기" on public.species for select to anon, authenticated using (true);

-- 5장 계수. 앱 업데이트 없이 대시보드에서 값을 고친다
create table public.coefficients (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create trigger coefficients_touch_updated_at
before update on public.coefficients
for each row execute function public.touch_updated_at();

alter table public.coefficients enable row level security;
create policy "coefficients: 누구나 읽기" on public.coefficients for select to anon, authenticated using (true);

-- 기상청 장마 발표를 반영하는 해별 계절 경계 (2차)
create table public.season_bounds (
  year int not null,
  season text not null check (season in ('spring', 'monsoon', 'heat', 'autumn', 'winter')),
  start_date date not null,
  end_date date not null,
  primary key (year, season),
  check (start_date <= end_date)
);

alter table public.season_bounds enable row level security;
create policy "season_bounds: 누구나 읽기" on public.season_bounds for select to anon, authenticated using (true);

-- 종 정보가 틀렸다는 신고. 앱은 넣기만 하고 읽지 못한다
create table public.species_reports (
  id bigint generated always as identity primary key,
  scientific_name text not null check (char_length(scientific_name) between 1 and 200),
  reason text not null check (char_length(reason) between 1 and 500),
  created_at timestamptz not null default now()
);

alter table public.species_reports enable row level security;
create policy "species_reports: 누구나 넣기" on public.species_reports for insert to anon, authenticated with check (true);

-- 날씨 캐시. Edge Function 만 쓴다 (정책 없음)
create table public.weather_cache (
  region_code text primary key,
  fetched_at timestamptz not null,
  payload jsonb not null
);

alter table public.weather_cache enable row level security;

-- 일일 한도 카운터. Edge Function 만 쓴다 (정책 없음).
-- subject 는 진단 한도용 기기 식별값의 해시이고(11.3), 함수 전체 한도는 빈 문자열이다. 48시간 뒤 지운다
create table public.usage_counters (
  date date not null,
  function_name text not null,
  subject text not null default '',
  count int not null default 0 check (count >= 0),
  primary key (date, function_name, subject)
);

alter table public.usage_counters enable row level security;

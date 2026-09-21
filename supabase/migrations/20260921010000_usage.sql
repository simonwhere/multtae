-- 일일 한도 카운터 (SPEC.md 9.1, 9.3, 11.3).
-- 여러 요청이 동시에 와도 정확히 세도록 DB 안에서 올리고 새 값을 돌려준다.
-- subject 는 진단 한도용 기기 식별값의 해시이고, 함수 전체 한도는 빈 문자열이다.

create or replace function public.bump_usage(p_function text, p_subject text default '')
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  insert into public.usage_counters (date, function_name, subject, count)
  values (current_date, p_function, p_subject, 1)
  on conflict (date, function_name, subject)
  do update set count = usage_counters.count + 1
  returning count into v_count;

  -- 48시간이 지난 기록은 남기지 않는다 (11.3). 매번 훑지 않도록 드물게만 지운다
  if random() < 0.01 then
    delete from public.usage_counters where date < current_date - 2;
  end if;

  return v_count;
end;
$$;

-- Edge Function(service role)만 부른다. 앱의 공개 키로는 부를 수 없다
revoke all on function public.bump_usage(text, text) from public, anon, authenticated;

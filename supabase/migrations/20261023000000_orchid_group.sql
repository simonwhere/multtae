-- 식물군에 난초·공중식물(orchid)을 더한다 (SPEC 5.1, 10.2, 태스크 10-1).
-- 호접란·춘란·풍란·틸란드시아는 바크·수태·착생 기준이라 열대 관엽과 다른 주기를 쓴다.
alter table public.species drop constraint if exists species_group_code_check;
alter table public.species add constraint species_group_code_check check (
  group_code in ('succulent', 'tropical', 'temperate', 'herb', 'orchid', 'bonsai_conifer', 'bonsai_deciduous')
);

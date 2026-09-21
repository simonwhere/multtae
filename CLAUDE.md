# 물때 (multtae)

한국 가정용 식물·분재 물주기 앱. 무료, 계정 없음, 사진 서버 미저장.
전체 기획은 SPEC.md. 태스크 번호(예: 2-3)는 SPEC.md 16장 표를 가리킨다.

## 스택

- apps/mobile: Expo SDK 최신 안정, TypeScript strict, expo-router, zustand, drizzle-orm + expo-sqlite
- supabase/functions: Deno Edge Functions (identify, light-grade, species, diagnose, weather)
- 테스트: vitest. src/engine 은 커버리지 100% 유지
- 패키지 매니저: pnpm, 워크스페이스

## 절대 규칙

- 사용자 사진·식물·공간 데이터를 서버에 저장하는 코드를 쓰지 않는다
- API 키는 앱 번들에 넣지 않는다. Edge Function 환경변수만 사용
- 물주기 엔진(src/engine)은 UI·DB에 의존하지 않는 순수 함수. 계수는 인자로 받는다
- 색은 src/ui/tokens.ts 의 토큰만 사용. 상태는 색만으로 구분하지 않고 이름표 글자나 체크 표시를 함께 쓴다 (디자인은 SPEC 14장 화원 라벨)
- 앱 내 문구는 존댓말, 느낌표 없음, 이모지 없음, 대시 문장부호 없음
- 하드코딩 한국어 문자열 금지, src/i18n/ko.ts 키 사용
- 명세와 다르게 해야 하는 이유가 생기면 구현 전에 먼저 묻는다

## 엔진 요약 (SPEC.md 5장)

I = clamp(B × S[g][season] × P × L × T × M × U, 1, 60)
계절 경계: 봄 3/1, 장마 6/21, 폭염 7/26, 가을 9/1, 겨울 11/16 (Asia/Seoul)
학습 U: wet ×1.15, dry ×0.85, droop 추가 ×0.9, 범위 0.5~2.0
테스트 케이스: SPEC.md 5.6 표 6개

## 작업 방식

- 세션당 태스크 1개. 시작 시 이 파일과 SPEC.md 해당 섹션을 읽는다
- 엔진·계절·스케줄러는 테스트 먼저 작성
- 끝나면 아래 진행 표를 갱신하고 커밋 메시지에 태스크 번호를 넣는다
- 화면에는 사용자가 원하는 결과만 보여 준다. 계산식·계수·내부 용어(계산, 기본값, 등급, 보정)는 문구에 쓰지 않고, 어색하거나 기계적인 문장은 쓰지 않는다

## 진행 상황

| 태스크 | 상태 | 메모 |
| --- | --- | --- |
| 1-1 | 완료 | 2026-09-20. Expo SDK 57(RN 0.86)·pnpm 12·drizzle·vitest. 화면은 apps/mobile/app, 별칭 @/ 는 src/. 시뮬레이터는 Expo Go로 확인. 5.6 테스트 6개는 1-2 구현 전까지 실패가 정상 |
| 1-2 | 완료 | 2026-09-20. computeInterval(mode: computed·hydro·manual, belowMin)·applyFeedback·applyRepot, 테스트 50개·커버리지 100%. 우선순위는 수동 고정 > 수경 > 계산, 고정 주기는 60일 상한 미적용. 반올림은 float 오차 보정(1e-9) 포함. 미루기·마지막 물 준 날 모름·다음 날짜 계산은 날짜 로직이라 1-3 이후로 남김 |
| 1-3 | 완료 | 2026-09-20. season.ts(getSeason·getSeasonAt·nextSeasonChange), calendar.ts(toSeoulDate·toCalendarDate·startOfDay·addDays·diffDays), nextWaterDate(미룬 횟수 포함)·halfIntervalDays. 계절은 Asia/Seoul 날짜로 판정, 날짜 연산은 UTC 오프셋을 인자로 받아 실행 환경 시간대와 무관(6개 TZ에서 확인). 테스트 108개·커버리지 100%. 미루기 최대 3회 규칙, "모름" 등록의 저장 방식, 계절 경계 조정값 저장은 2-2·2-3·설정에서 결정 |
| 1-4 | 완료 | 2026-09-20. plants.last_watered_unknown 추가(0001, SPEC 11.1 반영). DB 테스트는 src/db/testing/test-db.ts 로 실제 .sql 을 인메모리 node:sqlite 에 적용해서 돌린다(스키마·마이그레이션 어긋남, 업그레이드 경로, 외래 키·cascade, JSON 왕복). 스키마를 바꾸면 pnpm db:generate, 안 하면 테스트가 실패한다. 테스트는 tsconfig.test.json(Node 타입)으로 따로 타입체크. 시뮬레이터에서 0000→0001 업그레이드 확인. 결정: 미루기 최대 3회는 coefficients 에(2-3), 계절 경계 조정은 season_overrides 에 시작일로 저장(설정 화면) |
| 1-5 | 완료 | 2026-09-20. 토큰에 ink(글자·선)·surface(카드 면)·radius·spacing·motion 추가(SPEC 14.2 반영), 글자색은 soil.wet 이 아니라 ink. 서체는 assets/fonts 의 OFL 파일을 useFonts 로 로딩. src/ui: AppText·Card·Button·SoilGauge(band·pot, 상태별 질감, 600ms 번짐). 흙 상태는 engine 의 getSoilGaugeState. 컴포넌트는 개발용 /dev/gallery 에서 확인(Expo Go: exp://127.0.0.1:8081/--/dev/gallery). 토큰 대비는 tokens.test.ts 가 지킨다. 테스트 174개 |
| 2-1 | 완료 | 2026-09-20. 공간 등록: 사진(앨범·카메라, 1280px JPEG 80%, EXIF 제거, 문서 폴더 기준 상대 경로 저장) → 방향 → 유형 → 빛 등급(engine defaultLightGrade, 수정하면 manual) → 이름(자동 제안, 중복이면 번호)·저장. 규칙은 src/spaces/registration.ts 순수 함수, 초안은 settings.draft_space 에 저장해 이어서 한다. 저장소 함수는 Database 타입(src/db/types.ts)을 받고 늘 await. 홈은 공간 탭(4-5) 전까지 등록한 공간 목록을 보여 준다. 미구현: 나침반 방위 자동 제안(실기기 필요). 테스트 231개 |
| 2-2 | 완료 | 2026-09-20. 식물 등록: 사진(최대 3장, 첫 장 대표) → 종(번들 시드 30종 src/species/seed.ts 텍스트 검색, 모르겠어요면 식물군 직접 선택) → 화분(기본 중) → 흙 → 공간 → 분재(분재 수종이면 자동 선택) → 별명·마지막 물 준 날·첫 물주기와 계산식. 규칙은 src/plants/registration.ts, 계산식 글은 src/plants/formula.ts(1.0 인 공간·흙·보정은 생략). 식물군은 분재 토글이 우선, 일반 종을 분재로 키우면 종별 주기 대신 분재군 기본값. 물 준 날은 기기 로컬 정오, next_water_at 은 그날 0시로 저장. 등록 화면 공통 틀은 ui/RegistrationShell, 사진은 photos/photo-store.ts, 계수는 src/coefficients.ts 의 currentCoefficients(3-1 에서 서버 값 연결). 홈은 식물 카드(D-day, 흙 게이지)와 공간 목록. 미구현: 사진 부위 태그(3-5), 손바닥 비교 일러스트(7-4). 테스트 295개 |
| 2-3 | 완료 | 2026-09-20. 하단 탭 4개(오늘·공간·식물·기록, app/(tabs))와 + 버튼. 오늘 탭: 날짜·계절 배지(누르면 계절 설명 시트), 밀림(빨간 점, 카드 탭·물 줬어요만, 내일로 없음)·오늘(스와이프와 버튼으로 물 줬어요·내일로)·다가옴(3일 내)·오늘 물 줬어요(moss 완료). 규칙은 src/plants/today.ts 순수 함수(classifyToday·planWatering·planPostpone), 저장은 db/watering.ts recordWatering. 물 줬어요 시트: 흙 3지선다(안 고르면 skipped)·잎 처짐 → U 갱신 → 오늘부터 다시 계산, 기록에는 갱신 뒤 주기·계수 스냅샷을 남긴다. 수경·수동 고정은 배우지 않고, 수경은 물이 탁했어요만 받아 events note 로 저장. 미루기 최대 횟수는 coefficients.maxPostpones(3, SPEC 5.5 반영), engine canPostpone. 시트는 expo-router formSheet(fitToContents, 안에 flex:1 금지), 방금 물 준 카드의 번짐은 zustand ui-store 로 한 번만. 공간·식물 탭은 목록만, 기록 탭은 최근 물주기 50건(타임라인·통계는 5-4). 미구현: 분재 흙 확인 카드(4-2), 경고 카드·날씨 아이콘(5주차), 다가옴 카드 탭 → 식물 상세(2-5). 테스트 325개 |
| 2-4 | 완료 | 2026-09-21. 로컬 알림(expo-notifications, Expo Go 로 확인). 순수 함수: plants/schedule.ts(다음 물주기 재계산: next_water_at 은 마지막 물 준 날 + 주기(모름이면 I/2) + 미룬 횟수의 저장값이라 계절·계수·공간이 바뀌면 다시 센다. 밀린 식물·미룬 식물은 그대로, 지난 날짜는 오늘로), notifications/settings.ts(notify_time·dnd_start·dnd_end 는 "HH:MM", 기본 08:00, 방해금지는 종료 시각으로 이동), plan.ts(14일치, 물주기·밀림(+1일, 이후 3일마다)·계절 전환. 같은 아침 알림은 하나로 합쳐 하루 1개, id 는 type-yyyymmdd-slot, 수경은 "물 갈 때"), forecast.ts(14일 안의 계절 전환을 내다보고 전환 뒤 예정 식물을 새 계절로 미리 센다). scheduler.ts rescheduleAll 은 Notifier 를 받아 가짜로 테스트하고, 전체 취소 대신 계획에 없는 id 만 지우고 덮어쓴다(iOS 전체 취소가 비동기라 첫 예약이 빠지는 것을 시뮬레이터에서 확인, SPEC 12.3 반영). 겹친 요청은 coalesce 로 하나로. 트리거: 앱 진입(AppState)·물 줬어요·내일로·식물 등록. 권한은 식물이 생긴 뒤 오늘 탭에서 한 번 묻고(온보딩 3.1 이 생기면 거기로 옮긴다), 거부하면 오늘 탭 상단 배너 + 설정 열기. 알림을 누르면 오늘 탭. 점검 화면은 /dev/notifications. 미구현: 백그라운드 fetch(개발 빌드·실기기 필요), 분재 흙 체크(4-2, 지금은 분재도 물주기 알림), 날씨·작업·분갈이·재확인 알림, 설정 화면의 알림 시각·방해금지 입력, 수동 고정 식물의 계절 전환 질문(2-5), 안드로이드 미확인. 테스트 387개 |
| 2-5 | 완료 | 2026-09-21. 식물 상세 app/plant/[id].tsx: 사용자 결정으로 계산식·계수는 화면에 내지 않고 결과만 말한다("7일마다 물을 줘요", SPEC 1·3.4·4.2 반영). plants/formula.ts 는 format.ts 로 바꾸고 formatFormula 를 없앴다(등록 마지막 화면도 결과만). 규칙은 plants/care.ts 순수 함수: planManualInterval(1~60일, null 이면 자동으로 되돌림, U 유지)·planRepot(U 1.0, last_repot_at, repot 이벤트)·planMove(U 유지, move 이벤트)·planRename·feedbackStreak(같은 흙 상태 3회 연속, skipped 는 건너뛰고 분갈이 전 기록은 제외)·needsSeasonQuestion. 직접 고친 것은 밀렸거나 미룬 식물도 바로 다시 센다(schedule.ts countWaterDate, 지난 날짜는 오늘로). plants.manual_season 추가(0002, SPEC 11.1): 직접 정한 뒤 계절이 바뀌면 상세에서 자동으로 바꿀지 한 번 묻는다. 편집은 app/sheet/plant-edit.tsx(field: name·interval·repot·move). 공간 이동만 목록이 길 수 있어 modal 로 띄운다: formSheet fitToContents 안에 ScrollView 를 두면 제목이 밀려난다. db: deletePlant(사진 경로를 돌려주고 파일은 호출한 쪽이 지움)·listPlantWaterings. 진입: 식물 탭 카드, 오늘 탭의 다가옴·완료 카드. 앱 문구를 전체적으로 다듬었다: 계산·기본값·등급·수종군 같은 말을 빼고 자연스러운 문장으로. 미구현: 관리 카드(3-4), 분재 작업 캘린더(4-3), 식물 탭 정렬·필터, 사진 추가·대표 사진 변경. 테스트 403개 |
| 디자인 | 완료 | 2026-09-21. 사용자가 Claude 디자인 캔버스의 세 시안 중 B 화원 라벨을 골라 확정(https://claude.ai/artifact/5F7GgdGMwxGj4X4nNKWoHy). 베이지·세리프·갈색 흙 게이지를 버리고 옅은 잎빛 바탕, 깊은 잎 초록(accent), 새순 연두 강조 면(highlight), 열매 자주(berry)로 바꿨다(SPEC 14장 전면 개정, 색 규칙도 변경). 토큰은 ink·sub·paper·surface·hair·soft·block·accent·onAccent·highlight·gaugeEmpty·berry·berryTint·berryEmpty·sprig 이고 대비는 tokens.test.ts 가 라이트·다크 모두 지킨다. 서체는 Pretendard 유지, 큰 숫자와 학명만 Figtree(@expo-google-fonts/figtree, 한글이 없어 한글이 섞이는 곳에는 쓰지 않는다). Instrument Serif 는 뺐다. SoilGauge 대신 DayGauge(하루 한 칸, 14칸 상한, gauge-cells.ts 순수 함수, engine getSoilGaugeState 에 totalDays 추가). 새 컴포넌트 Tag·Sprig, DaysLeft 는 DueTag(오늘·D-3·N일 지남·완료)로. Button 은 테두리 없는 primary·secondary·surface, Card 는 tone highlight, 글자 변형 formula 는 caption 으로 이름을 바꿨고 caption·scientific 은 기본이 보조 글자색. 게임처럼 보이지 않게 굵은 테두리·어긋난 그림자·아주 두꺼운 글자·왼쪽 색 선 상자는 쓰지 않는다. 테스트 400개 |
| 3-1 | 부분 완료 | 2026-09-21. Supabase 프로젝트 없이 할 수 있는 부분까지. supabase/migrations/20260921000000_init.sql: species·coefficients·season_bounds·species_reports·weather_cache·usage_counters, 전 테이블 RLS(anon 은 종·계수·계절 경계 읽기와 신고 넣기만, 나머지는 service role). 사용자 데이터 테이블은 없다. 앱: src/coefficients/(parse.ts 서버 행 snake_case ↔ 엔진 camelCase, 전부 검사해서 하나라도 이상하면 버림 / index.ts currentCoefficients·loadCachedCoefficients·refreshCoefficients, settings.coefficients_cache / remote.ts EXPO_PUBLIC_SUPABASE_URL·ANON_KEY 가 비면 호출 안 함 / use-coefficients.ts 시작 시 캐시를 읽은 뒤 화면을 띄우고 서버 값은 뒤에서 받아 바뀌면 rescheduleSoon). seed.ts 가 번들 기본값에서 supabase/seed/coefficients.sql 을 만들고 seed.test.ts 가 어긋남과 RLS 누락을 지킨다(pnpm seed:coefficients). 남은 일(사용자 작업 필요): Supabase 프로젝트 생성, 마이그레이션·시드 적용, apps/mobile/.env 에 주소와 anon 키, 실제 서버에서 받아 오는지 확인. 테스트 429개 |

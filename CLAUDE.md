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
- 색은 src/ui/tokens.ts 의 토큰만 사용. 초록(moss)은 완료 상태 전용
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

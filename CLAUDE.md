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
| 1-4 | 대기 | |
| 1-5 | 대기 | |

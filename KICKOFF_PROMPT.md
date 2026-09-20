# Claude Code 착수 프롬프트

## 준비 (터미널에서 먼저)

```bash
mkdir multtae && cd multtae
git init
# SPEC.md 와 CLAUDE.md 를 이 폴더에 복사한 뒤
claude
```

## 세션 1 프롬프트 (그대로 붙여넣기)

```
SPEC.md와 CLAUDE.md를 읽어. 태스크 1-1을 진행한다.

1. pnpm 워크스페이스 모노레포를 만들고 apps/mobile 에 Expo(TypeScript strict, expo-router) 앱을 생성해. SDK는 최신 안정 버전.
2. SPEC.md 13.4 구조대로 폴더를 만들고, src/engine, src/db, src/ui, src/i18n, src/api, src/notifications 에 빈 index 파일을 둬.
3. drizzle-orm + expo-sqlite 를 설치하고 SPEC.md 11.1 의 spaces, plants, watering_logs, events, plant_tasks, photos, settings, species_cache 테이블 스키마를 src/db/schema.ts 에 작성해. 마이그레이션 설정까지.
4. src/ui/tokens.ts 에 SPEC.md 14.2 색 토큰(라이트·다크)과 14.3 타이포 스케일을 정의해.
5. src/engine/types.ts 에 SPEC.md 5장의 계수 구조(coefficients JSON 타입: 식물군 6개 기본 주기, 계절 계수표 6×5, 화분·빛·공간·흙 계수, 학습 보정 규칙, 계절 경계)를 정의하고, src/engine/defaults.ts 에 SPEC.md 5.1~5.4 표의 값을 그대로 넣어.
6. vitest 를 설정하고 src/engine/index.test.ts 에 SPEC.md 5.6 표 6개 케이스를 실패하는 테스트로 미리 작성해 (구현은 1-2에서).
7. iOS 시뮬레이터에서 빈 홈 화면이 뜨는 것까지 확인하고, CLAUDE.md 진행 표에 1-1 완료를 기록하고 커밋해.

완료 후 다음 세션 1-2(엔진 구현)를 위해 결정이 필요한 사항이 있으면 목록으로 알려줘.
```

## 세션 2 이후 프롬프트 골격

```
CLAUDE.md 진행 표를 확인하고 태스크 {번호}를 진행한다. SPEC.md {섹션}이 명세다.
테스트 먼저, 구현, 시뮬레이터 확인, 진행 표 갱신, 커밋 순서로 해.
명세와 다르게 해야 하는 이유가 생기면 구현 전에 먼저 물어봐.
```

예시:

```
CLAUDE.md 진행 표를 확인하고 태스크 1-2를 진행한다. SPEC.md 5장이 명세다.
src/engine/index.ts 에 computeInterval(plant, space, season, coefficients) 순수 함수를 구현해서
1-1에서 만든 5.6 테스트 6개를 전부 통과시켜. 5.5 엣지케이스(수경 고정 7일, 수동 고정, 분갈이 시 U 리셋, 1일 미만 클램프)도 각각 테스트를 추가해.
학습 보정 함수 applyFeedback(U, soilState, leafDroop) 도 5.4 표대로 구현하고 0.5~2.0 클램프 테스트 포함.
```

## 세션 순서 (SPEC.md 16장)

1주: 1-1 → 1-2 → 1-3 → 1-4 → 1-5
2주: 2-1 → 2-2 → 2-3 → 2-4 → 2-5 (여기서부터 실제 사용 시작)
3주: 3-1 → 3-2 → 3-3 → 3-4 → 3-5
4주: 4-1 → 4-2 → 4-3 → 4-4 → 4-5
5주: 5-1 → 5-2 → 5-3 → 5-4 → 5-5
6주: 6-1 → 6-2 → 6-3 → 6-4 → 6-5
7주: 7-1 → 7-2 → 7-3 → 7-4 → 7-5
8주: 8-1 → 8-2 → 8-3 → 8-4 → 8-5

## 세션 시작 전 사람이 준비할 것

- 1주차 중: Supabase 프로젝트, Pl@ntNet API 키, 공공데이터포털 키(기상청 단기예보, 에어코리아), Anthropic API 키
- 3-1 전에 Supabase URL·anon key·service role key 를 .env 에 넣고 .gitignore 확인
- 늦어도 6주차: Apple Developer, Google Play Console 가입

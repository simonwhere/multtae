/**
 * 물주기 엔진 타입 (SPEC.md 5장).
 *
 * I = clamp(B × S[g][s] × P × L × T × M × U, min, max)
 *
 * 코드 값(succulent, very_low 등)은 SPEC 표기 그대로이며 DB 컬럼 값과 계수 JSON의 키로 함께 쓴다.
 * 엔진은 이 파일의 타입만 알고 UI·DB에는 의존하지 않는다.
 */

/** 식물군 (SPEC 5.1) */
export const GROUP_CODES = [
  'succulent',
  'tropical',
  'temperate',
  'herb',
  'bonsai_conifer',
  'bonsai_deciduous',
] as const;
export type GroupCode = (typeof GROUP_CODES)[number];

/** 한국 5구간 계절 (SPEC 5.2) */
export const SEASONS = ['spring', 'monsoon', 'heat', 'autumn', 'winter'] as const;
export type Season = (typeof SEASONS)[number];

/** 화분 크기: 소 / 중 / 대 / 특대 (SPEC 5.3 P) */
export const POT_SIZES = ['s', 'm', 'l', 'xl'] as const;
export type PotSize = (typeof POT_SIZES)[number];

/** 빛 등급: 강광 / 중광 / 약광 / 저광 (SPEC 5.3 L) */
export const LIGHT_GRADES = ['high', 'medium', 'low', 'very_low'] as const;
export type LightGrade = (typeof LIGHT_GRADES)[number];

/** 창이 향한 방향 (SPEC 4.1). unknown 은 "모름" */
export const DIRECTIONS = ['S', 'E', 'W', 'N', 'unknown'] as const;
export type Direction = (typeof DIRECTIONS)[number];

/** 공간 유형 (SPEC 5.3 T) */
export const SPACE_TYPES = ['indoor_window', 'indoor_far', 'balcony_ext', 'terrace'] as const;
export type SpaceType = (typeof SPACE_TYPES)[number];

/** 흙 종류 (SPEC 5.3 M). hydro 는 계수가 아니라 고정 주기로 처리한다 */
export const SOIL_TYPES = ['potting', 'gritty', 'akadama', 'hydro'] as const;
export type SoilType = (typeof SOIL_TYPES)[number];
/** 곱셈 계수를 갖는 흙 종류 */
export type MultiplierSoilType = Exclude<SoilType, 'hydro'>;

/** 물 줄 때 입력하는 흙 상태 (SPEC 5.4) */
export const SOIL_STATES = ['dry', 'ok', 'wet'] as const;
export type SoilState = (typeof SOIL_STATES)[number];

/** 기록되는 흙 상태. 입력을 건너뛰면 skipped 이고 학습에서는 ok 와 같이 U 를 유지한다 (SPEC 3.2) */
export const LOGGED_SOIL_STATES = [...SOIL_STATES, 'skipped'] as const;
export type LoggedSoilState = (typeof LOGGED_SOIL_STATES)[number];

/** 이 앱 버전이 이해하는 계수 스키마 버전 (SPEC 15장 버전 항목) */
export const COEFFICIENTS_SCHEMA_VERSION = 1;

/** 연도 없는 날짜 */
export interface MonthDay {
  /** 1~12 */
  month: number;
  /** 1~31 */
  day: number;
}

/** 시각 정보가 없는 달력 날짜. 어느 시간대의 달력인지는 만든 쪽이 정한다 (calendar.ts) */
export interface CalendarDate extends MonthDay {
  year: number;
}

/** 계절 시작일 표. 각 계절은 다음 계절 시작 전날에 끝난다 (SPEC 5.2). Asia/Seoul 달력 기준 */
export type SeasonBounds = Record<Season, MonthDay>;

/** 계절 전환. date 의 0시(Asia/Seoul)부터 season 이다 */
export interface SeasonChange {
  season: Season;
  date: CalendarDate;
}

/** 학습 보정 U 규칙 (SPEC 5.4) */
export interface LearningRules {
  /** U 초기값 */
  initial: number;
  /** U 하한 */
  min: number;
  /** U 상한 */
  max: number;
  /** 흙 상태 입력별 U 배율 */
  soilState: Record<SoilState, number>;
  /** "잎이 처졌어요" 체크 시 추가 배율 */
  leafDroop: number;
  /** 같은 방향 입력이 이 횟수만큼 연속되면 식물 상세에 안내를 띄운다 */
  streakNotice: number;
}

/**
 * coefficients JSON (SPEC 5장, 11.2).
 * 서버 값·로컬 캐시·번들 기본값(defaults.ts) 어느 것이든 이 형태로 엔진에 넘긴다.
 */
export interface Coefficients {
  /** 계수 스키마 버전. 앱이 아는 버전보다 높으면 번들 기본값을 쓴다 */
  version: number;
  /** B: 식물군 기본 주기(일). 봄·중광·중형 화분·배양토·실내 기준 (5.1) */
  baseInterval: Record<GroupCode, number>;
  /** S: 계절 계수표, 식물군 6 × 계절 5 (5.2) */
  season: Record<GroupCode, Record<Season, number>>;
  /** P: 화분 계수 (5.3) */
  pot: Record<PotSize, number>;
  /** L: 빛 계수 (5.3) */
  light: Record<LightGrade, number>;
  /** T: 공간 유형 계수 (5.3) */
  spaceType: Record<SpaceType, number>;
  /** M: 흙 계수. 수경은 제외 (5.3) */
  soil: Record<MultiplierSoilType, number>;
  /** 수경: 계수를 무시하고 물 교체 주기를 이 일수로 고정한다 (5.3, 5.5) */
  hydroFixedDays: number;
  /** 최종 주기를 자르는 범위(일) */
  intervalClamp: { min: number; max: number };
  /** U: 학습 보정 규칙 (5.4) */
  learning: LearningRules;
  /** "내일로" 미루기를 연속으로 할 수 있는 횟수. 넘으면 밀림으로 둔다 (5.5) */
  maxPostpones: number;
  /** 계절 시작일 (5.2 계절 경계) */
  seasonBounds: SeasonBounds;
}

/** 엔진이 식물에서 읽는 값 (plants 테이블의 부분집합) */
export interface EnginePlant {
  groupCode: GroupCode;
  potSize: PotSize;
  soilType: SoilType;
  /** U */
  learnFactor: number;
  /** 종 DB의 종별 기본 주기(일). 없으면 식물군 기본값을 쓴다 */
  baseInterval?: number | null;
  /** 수동 고정 일수. null 이면 자동 계산 */
  manualInterval?: number | null;
}

/** 엔진이 공간에서 읽는 값 (spaces 테이블의 부분집합) */
export interface EngineSpace {
  lightGrade: LightGrade;
  spaceType: SpaceType;
}

/** 계산에 쓰인 계수 값. 식물 상세의 계산식과 watering_logs.factor_snapshot 에 쓴다 */
export interface IntervalFactors {
  /** B */
  base: number;
  /** S */
  season: number;
  /** P */
  pot: number;
  /** L */
  light: number;
  /** T */
  spaceType: number;
  /** M */
  soil: number;
  /** U */
  learn: number;
}

/** 계수 곱으로 계산한 주기 */
export interface ComputedInterval {
  mode: 'computed';
  factors: IntervalFactors;
  /** 자르기 전 곱셈 결과 (일) */
  raw: number;
  /** clamp(raw, min, max) */
  interval: number;
  /** round(interval), 0.5 이상 올림. 다음 물주기 = 마지막 물 준 날 + days */
  days: number;
  /** raw 가 하한보다 작아 잘렸다. 분재가 아니면 "매일 흙 확인" 문구를 띄운다 (SPEC 5.5) */
  belowMin: boolean;
}

/**
 * 계수를 무시하는 고정 주기 (SPEC 5.5).
 * manual: 사용자가 고정한 일수, hydro: 수경 물 교체 주기. 둘 다 해당하면 manual 이 우선한다.
 * 사용자의 명시적 선택이므로 상한으로 자르지 않는다.
 */
export interface FixedInterval {
  mode: 'manual' | 'hydro';
  /** 고정 일수 그대로 */
  interval: number;
  /** round(interval), 0.5 이상 올림, 최소 1일 */
  days: number;
}

export type IntervalResult = ComputedInterval | FixedInterval;
export type IntervalMode = IntervalResult['mode'];

/**
 * 물주기 엔진 (SPEC.md 5장). UI·DB 에 의존하지 않는 순수 함수이고 계수는 모두 인자로 받는다.
 */
import type {
  Coefficients,
  EnginePlant,
  EngineSpace,
  IntervalFactors,
  IntervalResult,
  LoggedSoilState,
  Season,
} from './types';

export { DEFAULT_COEFFICIENTS } from './defaults';
export * from './types';

/** 다음 물주기는 아무리 짧아도 하루 뒤다 */
const MIN_DAYS = 1;

/**
 * 수학적으로는 x.5 인 곱이 부동소수점 오차로 x.4999… 가 되는 경우를 올림으로 되돌린다.
 * 예: 18 × 2.5 × 0.7 = 31.499999999999996
 */
const ROUNDING_EPSILON = 1e-9;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** 0.5 이상 올림 */
function toDays(interval: number): number {
  return Math.max(MIN_DAYS, Math.floor(interval + 0.5 + ROUNDING_EPSILON));
}

function isUsableManualInterval(value: number | null | undefined): value is number {
  return value != null && Number.isFinite(value) && value > 0;
}

/**
 * I = clamp(B × S[g][s] × P × L × T × M × U, min, max)
 *
 * 수동 고정과 수경은 계수를 무시한 고정 주기를 돌려준다. 둘 다면 수동 고정이 우선한다 (5.5).
 */
export function computeInterval(
  plant: EnginePlant,
  space: EngineSpace,
  season: Season,
  coefficients: Coefficients,
): IntervalResult {
  if (isUsableManualInterval(plant.manualInterval)) {
    return { mode: 'manual', interval: plant.manualInterval, days: toDays(plant.manualInterval) };
  }

  if (plant.soilType === 'hydro') {
    const interval = coefficients.hydroFixedDays;
    return { mode: 'hydro', interval, days: toDays(interval) };
  }

  const factors: IntervalFactors = {
    base: plant.baseInterval ?? coefficients.baseInterval[plant.groupCode],
    season: coefficients.season[plant.groupCode][season],
    pot: coefficients.pot[plant.potSize],
    light: coefficients.light[space.lightGrade],
    spaceType: coefficients.spaceType[space.spaceType],
    soil: coefficients.soil[plant.soilType],
    learn: plant.learnFactor,
  };
  const raw =
    factors.base *
    factors.season *
    factors.pot *
    factors.light *
    factors.spaceType *
    factors.soil *
    factors.learn;
  const { min, max } = coefficients.intervalClamp;
  const interval = clamp(raw, min, max);

  return {
    mode: 'computed',
    factors,
    raw,
    interval,
    days: toDays(interval),
    belowMin: raw < min,
  };
}

/**
 * 물 줄 때 입력한 흙 상태로 학습 보정 U 를 갱신한다 (5.4).
 * 건너뛴 입력은 적당했음과 같고, 잎 처짐은 흙 상태와 별개로 한 번 더 곱한다.
 */
export function applyFeedback(
  learnFactor: number,
  soilState: LoggedSoilState,
  leafDroop: boolean,
  coefficients: Coefficients,
): number {
  const { learning } = coefficients;
  const soilMultiplier = soilState === 'skipped' ? 1 : learning.soilState[soilState];
  const droopMultiplier = leafDroop ? learning.leafDroop : 1;

  return clamp(learnFactor * soilMultiplier * droopMultiplier, learning.min, learning.max);
}

/**
 * 분갈이: 화분·흙을 반영하고 U 를 초기값으로 되돌린다 (5.5, 8.3).
 * 같은 화분에 다시 심어도 흙이 바뀌므로 되돌린다.
 */
export function applyRepot(
  plant: EnginePlant,
  change: Partial<Pick<EnginePlant, 'potSize' | 'soilType'>>,
  coefficients: Coefficients,
): EnginePlant {
  return {
    ...plant,
    potSize: change.potSize ?? plant.potSize,
    soilType: change.soilType ?? plant.soilType,
    learnFactor: coefficients.learning.initial,
  };
}

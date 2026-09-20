import type { Coefficients, EnginePlant, EngineSpace, IntervalResult, Season } from './types';

// 구현은 태스크 1-2. 그때까지 index.test.ts 의 SPEC 5.6 케이스는 실패한다.
export function computeInterval(
  _plant: EnginePlant,
  _space: EngineSpace,
  _season: Season,
  _coefficients: Coefficients,
): IntervalResult {
  throw new Error('computeInterval: not implemented (task 1-2)');
}

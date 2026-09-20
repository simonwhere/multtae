import { describe, expect, it } from 'vitest';

import { DEFAULT_COEFFICIENTS } from './defaults';
import { computeInterval } from './index';
import type { EnginePlant, EngineSpace, IntervalFactors, Season } from './types';

interface SpecCase {
  name: string;
  plant: EnginePlant;
  space: EngineSpace;
  season: Season;
  /** 5.6 표 "계산" 열의 각 항: B × S × P × L × T × M × U */
  factors: IntervalFactors;
  /** 5.6 표 "계산" 열의 곱 */
  raw: number;
  /** clamp(raw, 1, 60) */
  interval: number;
  /** 5.6 표 "결과" 열 (일) */
  days: number;
}

// SPEC.md 5.6 계산 예시 표. 행 순서도 표와 같다.
const SPEC_CASES: SpecCase[] = [
  {
    name: '몬스테라: 가을, 중형, 북향 실내 창가(약광), 배양토, U 1.0 → 9일',
    plant: { groupCode: 'tropical', potSize: 'm', soilType: 'potting', learnFactor: 1.0 },
    space: { lightGrade: 'low', spaceType: 'indoor_window' },
    season: 'autumn',
    factors: { base: 7, season: 1.0, pot: 1.0, light: 1.3, spaceType: 1.0, soil: 1.0, learn: 1.0 },
    raw: 9.1,
    interval: 9.1,
    days: 9,
  },
  {
    name: '같은 몬스테라: 겨울·난방 → 15일',
    plant: { groupCode: 'tropical', potSize: 'm', soilType: 'potting', learnFactor: 1.0 },
    space: { lightGrade: 'low', spaceType: 'indoor_window' },
    season: 'winter',
    factors: { base: 7, season: 1.6, pot: 1.0, light: 1.3, spaceType: 1.0, soil: 1.0, learn: 1.0 },
    raw: 14.56,
    interval: 14.56,
    days: 15,
  },
  {
    name: '에케베리아: 겨울, 소형, 남향 창가(강광), 배양토 → 20일',
    plant: { groupCode: 'succulent', potSize: 's', soilType: 'potting', learnFactor: 1.0 },
    space: { lightGrade: 'high', spaceType: 'indoor_window' },
    season: 'winter',
    factors: { base: 14, season: 2.5, pot: 0.7, light: 0.8, spaceType: 1.0, soil: 1.0, learn: 1.0 },
    raw: 19.6,
    interval: 19.6,
    days: 20,
  },
  {
    name: '흑송 분재: 폭염, 중형, 남향 테라스(강광), 적옥토 → 1일 (하한으로 자름)',
    plant: { groupCode: 'bonsai_conifer', potSize: 'm', soilType: 'akadama', learnFactor: 1.0 },
    space: { lightGrade: 'high', spaceType: 'terrace' },
    season: 'heat',
    factors: { base: 2, season: 0.5, pot: 1.0, light: 0.8, spaceType: 0.7, soil: 0.6, learn: 1.0 },
    raw: 0.336,
    interval: 1,
    days: 1,
  },
  {
    name: '단풍 분재: 겨울, 대형, 테라스(강광), 적옥토 → 1일',
    plant: { groupCode: 'bonsai_deciduous', potSize: 'l', soilType: 'akadama', learnFactor: 1.0 },
    space: { lightGrade: 'high', spaceType: 'terrace' },
    season: 'winter',
    factors: { base: 1.5, season: 2.0, pot: 1.3, light: 0.8, spaceType: 0.7, soil: 0.6, learn: 1.0 },
    // 표에는 1.31 로 적혀 있다
    raw: 1.3104,
    interval: 1.3104,
    days: 1,
  },
  {
    name: '바질: 폭염, 소형, 서향 발코니 확장(강광), 배양토 → 1일 (하한으로 자름)',
    plant: { groupCode: 'herb', potSize: 's', soilType: 'potting', learnFactor: 1.0 },
    space: { lightGrade: 'high', spaceType: 'balcony_ext' },
    season: 'heat',
    factors: { base: 3, season: 0.5, pot: 0.7, light: 0.8, spaceType: 0.9, soil: 1.0, learn: 1.0 },
    raw: 0.756,
    interval: 1,
    days: 1,
  },
];

describe('computeInterval: SPEC.md 5.6 계산 예시', () => {
  it.each(SPEC_CASES)('$name', ({ plant, space, season, factors, raw, interval, days }) => {
    const result = computeInterval(plant, space, season, DEFAULT_COEFFICIENTS);

    expect(result.factors).toEqual(factors);
    expect(result.raw).toBeCloseTo(raw, 6);
    expect(result.interval).toBeCloseTo(interval, 6);
    expect(result.days).toBe(days);
  });
});

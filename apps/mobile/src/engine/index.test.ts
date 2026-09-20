import { assert, describe, expect, it } from 'vitest';

import { applyFeedback, applyRepot, computeInterval, DEFAULT_COEFFICIENTS } from './index';
import type {
  Coefficients,
  ComputedInterval,
  EnginePlant,
  EngineSpace,
  IntervalFactors,
  Season,
} from './index';

const C = DEFAULT_COEFFICIENTS;

const monstera: EnginePlant = {
  groupCode: 'tropical',
  potSize: 'm',
  soilType: 'potting',
  learnFactor: 1.0,
};
/** 북향 실내 창가 (약광) */
const northWindow: EngineSpace = { lightGrade: 'low', spaceType: 'indoor_window' };
/** 중광 실내 창가. L 과 T 가 모두 1.0 이다 */
const brightWindow: EngineSpace = { lightGrade: 'medium', spaceType: 'indoor_window' };
const terrace: EngineSpace = { lightGrade: 'high', spaceType: 'terrace' };

function computed(...args: Parameters<typeof computeInterval>): ComputedInterval {
  const result = computeInterval(...args);
  assert(result.mode === 'computed', `computed 를 기대했는데 ${result.mode} 가 나왔다`);
  return result;
}

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

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
    const result = computed(plant, space, season, C);

    expect(result.factors).toEqual(factors);
    expect(result.raw).toBeCloseTo(raw, 6);
    expect(result.interval).toBeCloseTo(interval, 6);
    expect(result.days).toBe(days);
  });
});

describe('computeInterval: 계수와 반올림', () => {
  it('학습 보정 U 를 곱한다 (SPEC 3.4: 7일 × 가을 1.0 × 중형 1.0 × 중광 1.0 × 보정 1.15 = 8일)', () => {
    const result = computed({ ...monstera, learnFactor: 1.15 }, brightWindow, 'autumn', C);

    expect(result.factors.learn).toBe(1.15);
    expect(result.raw).toBeCloseTo(8.05, 6);
    expect(result.days).toBe(8);
  });

  it('종별 기본 주기가 있으면 식물군 기본값보다 우선한다', () => {
    const result = computed({ ...monstera, baseInterval: 10 }, brightWindow, 'spring', C);

    expect(result.factors.base).toBe(10);
    expect(result.days).toBe(10);
  });

  it('종별 기본 주기가 null 이면 식물군 기본값을 쓴다', () => {
    const result = computed({ ...monstera, baseInterval: null }, brightWindow, 'spring', C);

    expect(result.factors.base).toBe(7);
  });

  it('0.5 는 올린다: 1.5일 → 2일', () => {
    const maple: EnginePlant = {
      groupCode: 'bonsai_deciduous',
      potSize: 'm',
      soilType: 'potting',
      learnFactor: 1.0,
    };
    const result = computed(maple, brightWindow, 'spring', C);

    expect(result.raw).toBe(1.5);
    expect(result.days).toBe(2);
  });

  it('부동소수점 오차로 0.5 경계 아래로 떨어진 값도 올린다: 18 × 2.5 × 0.7 = 31.5일 → 32일', () => {
    // float 으로는 31.499999999999996 이 나온다
    const succulent: EnginePlant = {
      groupCode: 'succulent',
      potSize: 's',
      soilType: 'potting',
      learnFactor: 1.0,
      baseInterval: 18,
    };
    const result = computed(succulent, brightWindow, 'winter', C);

    expect(result.raw).toBeCloseTo(31.5, 6);
    expect(result.days).toBe(32);
  });

  it('공간을 옮기면 빛·공간 계수만 바뀌고 U 는 유지된다 (SPEC 5.5 공간 이동)', () => {
    const learned = { ...monstera, learnFactor: 1.3 };
    const indoors = computed(learned, northWindow, 'spring', C);
    const outdoors = computed(learned, terrace, 'spring', C);

    expect(indoors.factors).toMatchObject({ light: 1.3, spaceType: 1.0, learn: 1.3 });
    expect(outdoors.factors).toMatchObject({ light: 0.8, spaceType: 0.7, learn: 1.3 });
  });

  it('계수는 인자로 받은 값을 쓴다', () => {
    const custom: Coefficients = {
      ...C,
      pot: { ...C.pot, m: 2 },
      intervalClamp: { min: 2, max: 30 },
    };

    // 7 × 1.0 × 2 × 1.3 = 18.2
    expect(computed(monstera, northWindow, 'autumn', custom).days).toBe(18);
    // 0.756 → 하한 2
    const basil = computed(SPEC_CASES[5].plant, SPEC_CASES[5].space, 'heat', custom);
    expect(basil).toMatchObject({ interval: 2, days: 2, belowMin: true });
    // 14 × 2.5 × 1.6 × 1.6 = 89.6 → 상한 30
    const bigSucculent: EnginePlant = { ...SPEC_CASES[2].plant, potSize: 'xl' };
    const dim: EngineSpace = { lightGrade: 'very_low', spaceType: 'indoor_far' };
    expect(computed(bigSucculent, dim, 'winter', custom).days).toBe(30);
  });

  it('입력을 바꾸지 않는다', () => {
    const plant = deepFreeze({ ...monstera });
    const space = deepFreeze({ ...northWindow });
    const coefficients = deepFreeze(structuredClone(C));

    expect(() => computeInterval(plant, space, 'autumn', coefficients)).not.toThrow();
  });
});

describe('computeInterval: SPEC.md 5.5 주기 자르기', () => {
  it('1일 미만이면 1일로 고정하고 belowMin 으로 알린다', () => {
    const blackPine = computed(SPEC_CASES[3].plant, SPEC_CASES[3].space, 'heat', C);

    expect(blackPine.raw).toBeLessThan(1);
    expect(blackPine).toMatchObject({ interval: 1, days: 1, belowMin: true });
  });

  it('정확히 1일이면 잘린 것이 아니다', () => {
    const pine: EnginePlant = {
      groupCode: 'bonsai_conifer',
      potSize: 'm',
      soilType: 'potting',
      learnFactor: 1.0,
    };
    // 2 × 0.5 = 1.0
    const result = computed(pine, brightWindow, 'heat', C);

    expect(result).toMatchObject({ raw: 1, interval: 1, days: 1, belowMin: false });
  });

  it('1일 이상이면 belowMin 은 false 다', () => {
    expect(computed(monstera, northWindow, 'autumn', C).belowMin).toBe(false);
  });

  it('60일을 넘으면 60일로 자른다', () => {
    const bigSucculent: EnginePlant = {
      groupCode: 'succulent',
      potSize: 'xl',
      soilType: 'potting',
      learnFactor: 1.0,
    };
    const dim: EngineSpace = { lightGrade: 'very_low', spaceType: 'indoor_far' };
    // 14 × 2.5 × 1.6 × 1.6 = 89.6
    const result = computed(bigSucculent, dim, 'winter', C);

    expect(result.raw).toBeCloseTo(89.6, 6);
    expect(result).toMatchObject({ interval: 60, days: 60, belowMin: false });
  });
});

describe('computeInterval: SPEC.md 5.5 수경', () => {
  const hydro: EnginePlant = { ...monstera, soilType: 'hydro' };

  it('계수를 무시하고 물 교체 7일로 고정한다', () => {
    expect(computeInterval(hydro, northWindow, 'autumn', C)).toEqual({
      mode: 'hydro',
      interval: 7,
      days: 7,
    });
  });

  it('계절·화분·빛·U 가 달라도 7일이다', () => {
    const result = computeInterval(
      { ...hydro, potSize: 'xl', learnFactor: 2.0 },
      terrace,
      'heat',
      C,
    );

    expect(result).toMatchObject({ mode: 'hydro', days: 7 });
  });

  it('고정 일수는 계수에서 읽는다', () => {
    const custom: Coefficients = { ...C, hydroFixedDays: 10 };

    expect(computeInterval(hydro, northWindow, 'autumn', custom)).toMatchObject({
      mode: 'hydro',
      interval: 10,
      days: 10,
    });
  });
});

describe('computeInterval: SPEC.md 5.5 주기 수동 고정', () => {
  it('고정한 일수를 그대로 쓰고 엔진 계산을 하지 않는다', () => {
    const result = computeInterval({ ...monstera, manualInterval: 10 }, northWindow, 'winter', C);

    expect(result).toEqual({ mode: 'manual', interval: 10, days: 10 });
  });

  it('사용자가 정한 값이므로 60일 상한으로 자르지 않는다', () => {
    const result = computeInterval({ ...monstera, manualInterval: 90 }, northWindow, 'winter', C);

    expect(result).toMatchObject({ mode: 'manual', interval: 90, days: 90 });
  });

  it('소수 입력은 0.5 이상 올림한다', () => {
    const result = computeInterval({ ...monstera, manualInterval: 2.5 }, northWindow, 'winter', C);

    expect(result).toMatchObject({ mode: 'manual', interval: 2.5, days: 3 });
  });

  it('1일보다 짧게 고정해도 다음 물주기는 최소 1일 뒤다', () => {
    const result = computeInterval({ ...monstera, manualInterval: 0.4 }, northWindow, 'winter', C);

    expect(result).toMatchObject({ mode: 'manual', interval: 0.4, days: 1 });
  });

  it('수경이어도 수동 고정이 우선한다', () => {
    const result = computeInterval(
      { ...monstera, soilType: 'hydro', manualInterval: 14 },
      northWindow,
      'autumn',
      C,
    );

    expect(result).toEqual({ mode: 'manual', interval: 14, days: 14 });
  });

  it('null 이면 자동 계산한다', () => {
    const result = computeInterval({ ...monstera, manualInterval: null }, northWindow, 'autumn', C);

    expect(result).toMatchObject({ mode: 'computed', days: 9 });
  });

  it.each([0, -3, Number.NaN, Number.POSITIVE_INFINITY])(
    '쓸 수 없는 값(%s)은 무시하고 자동 계산한다',
    (manualInterval) => {
      const result = computeInterval({ ...monstera, manualInterval }, northWindow, 'autumn', C);

      expect(result).toMatchObject({ mode: 'computed', days: 9 });
    },
  );
});

describe('applyFeedback: SPEC.md 5.4 학습 보정 U', () => {
  it('아직 축축했음(wet): ×1.15', () => {
    expect(applyFeedback(1.0, 'wet', false, C)).toBeCloseTo(1.15, 10);
  });

  it('적당했음(ok): 유지', () => {
    expect(applyFeedback(1.2, 'ok', false, C)).toBe(1.2);
  });

  it('바싹 말랐음(dry): ×0.85', () => {
    expect(applyFeedback(1.0, 'dry', false, C)).toBeCloseTo(0.85, 10);
  });

  it('건너뜀(skipped): 적당했음처럼 유지', () => {
    expect(applyFeedback(1.2, 'skipped', false, C)).toBe(1.2);
  });

  it('잎이 처졌어요: 추가 ×0.9', () => {
    expect(applyFeedback(1.0, 'ok', true, C)).toBeCloseTo(0.9, 10);
    expect(applyFeedback(1.0, 'skipped', true, C)).toBeCloseTo(0.9, 10);
    expect(applyFeedback(1.0, 'wet', true, C)).toBeCloseTo(1.035, 10);
  });

  it('바싹 말랐음 + 잎이 처졌어요: 0.85 × 0.9 = 0.765 (표의 0.77 은 반올림 표기)', () => {
    expect(applyFeedback(1.0, 'dry', true, C)).toBeCloseTo(0.765, 10);
  });

  it('이전 U 에 누적해서 곱한다', () => {
    const twice = applyFeedback(applyFeedback(1.0, 'wet', false, C), 'wet', false, C);

    expect(twice).toBeCloseTo(1.3225, 10);
  });

  it('상한 2.0 으로 자른다', () => {
    expect(applyFeedback(1.9, 'wet', false, C)).toBe(2.0);
    expect(applyFeedback(2.0, 'wet', false, C)).toBe(2.0);
  });

  it('하한 0.5 로 자른다', () => {
    expect(applyFeedback(0.55, 'dry', true, C)).toBe(0.5);
    expect(applyFeedback(0.5, 'dry', false, C)).toBe(0.5);
  });

  it('같은 입력이 계속돼도 0.5~2.0 을 벗어나지 않는다', () => {
    let wet = 1.0;
    let dry = 1.0;
    for (let i = 0; i < 20; i += 1) {
      wet = applyFeedback(wet, 'wet', false, C);
      dry = applyFeedback(dry, 'dry', true, C);
    }

    expect(wet).toBe(2.0);
    expect(dry).toBe(0.5);
  });

  it('배율과 범위는 인자로 받은 계수에서 읽는다', () => {
    const custom: Coefficients = {
      ...C,
      learning: {
        ...C.learning,
        max: 1.4,
        soilState: { ...C.learning.soilState, wet: 1.5 },
        leafDroop: 0.5,
      },
    };

    expect(applyFeedback(0.8, 'wet', false, custom)).toBeCloseTo(1.2, 10);
    expect(applyFeedback(1.0, 'wet', false, custom)).toBe(1.4);
    expect(applyFeedback(1.0, 'ok', true, custom)).toBe(0.5);
  });

  it('시나리오 B: 축축했음을 입력하면 몬스테라 주기가 7일에서 8일로 늘어난다', () => {
    const before = computeInterval(monstera, brightWindow, 'autumn', C);
    const learnFactor = applyFeedback(monstera.learnFactor, 'wet', false, C);
    const after = computeInterval({ ...monstera, learnFactor }, brightWindow, 'autumn', C);

    expect(before.days).toBe(7);
    expect(after.days).toBe(8);
  });
});

describe('applyRepot: SPEC.md 5.5 분갈이', () => {
  const learned: EnginePlant = { ...monstera, learnFactor: 1.4, baseInterval: 8 };

  it('화분 크기를 바꾸면 U 를 1.0 으로 되돌린다', () => {
    const repotted = applyRepot(learned, { potSize: 'l' }, C);

    expect(repotted).toEqual({ ...learned, potSize: 'l', learnFactor: 1.0 });
  });

  it('흙만 바꿔도 U 를 되돌린다', () => {
    const repotted = applyRepot(learned, { soilType: 'gritty' }, C);

    expect(repotted).toEqual({ ...learned, soilType: 'gritty', learnFactor: 1.0 });
  });

  it('화분과 흙을 함께 바꾼다', () => {
    const repotted = applyRepot(learned, { potSize: 'xl', soilType: 'akadama' }, C);

    expect(repotted).toEqual({
      ...learned,
      potSize: 'xl',
      soilType: 'akadama',
      learnFactor: 1.0,
    });
  });

  it('같은 화분에 다시 심어도 흙이 바뀌었으므로 U 를 되돌린다', () => {
    expect(applyRepot(learned, {}, C)).toEqual({ ...learned, learnFactor: 1.0 });
  });

  it('U 초기값은 인자로 받은 계수에서 읽는다', () => {
    const custom: Coefficients = { ...C, learning: { ...C.learning, initial: 1.1 } };

    expect(applyRepot(learned, { potSize: 'l' }, custom).learnFactor).toBe(1.1);
  });

  it('원본 식물을 바꾸지 않는다', () => {
    const frozen = deepFreeze({ ...learned });

    expect(() => applyRepot(frozen, { potSize: 'l' }, C)).not.toThrow();
    expect(frozen.learnFactor).toBe(1.4);
  });

  it('분갈이 뒤에는 새 화분 계수와 U 1.0 으로 다시 계산된다', () => {
    // 8 × 1.0 × 1.0 × 1.0 × 1.0 × 1.0 × 1.4 = 11.2 → 11일
    expect(computeInterval(learned, brightWindow, 'spring', C).days).toBe(11);
    // 8 × 1.0 × 1.3 × 1.0 × 1.0 × 1.0 × 1.0 = 10.4 → 10일
    const repotted = applyRepot(learned, { potSize: 'l' }, C);
    expect(computeInterval(repotted, brightWindow, 'spring', C).days).toBe(10);
  });
});

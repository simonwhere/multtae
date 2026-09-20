import { describe, expect, it } from 'vitest';

import { computeInterval, DEFAULT_COEFFICIENTS } from '../engine';
import type { EnginePlant, EngineSpace, Season } from '../engine';
import { formatDaysLeft, formatFactor, formatFormula, formatMonthDay } from './formula';

const C = DEFAULT_COEFFICIENTS;

function formula(plant: EnginePlant, space: EngineSpace, season: Season): string {
  return formatFormula(computeInterval(plant, space, season, C), {
    season,
    potSize: plant.potSize,
    soilType: plant.soilType,
    lightGrade: space.lightGrade,
    spaceType: space.spaceType,
  });
}

const monstera: EnginePlant = {
  groupCode: 'tropical',
  potSize: 'm',
  soilType: 'potting',
  learnFactor: 1.0,
};
const brightWindow: EngineSpace = { lightGrade: 'medium', spaceType: 'indoor_window' };

describe('formatFormula: 계산 근거 공개 (SPEC.md 1, 3.4)', () => {
  it('SPEC 3.4 의 예시 그대로 나온다', () => {
    expect(formula({ ...monstera, learnFactor: 1.15 }, brightWindow, 'autumn')).toBe(
      '7일 × 가을 1.0 × 중형 1.0 × 중광 1.0 × 보정 1.15 = 8일',
    );
  });

  it('시나리오 A: 1.0 인 공간·흙·보정은 생략한다', () => {
    expect(formula(monstera, brightWindow, 'autumn')).toBe(
      '7일 × 가을 1.0 × 중형 1.0 × 중광 1.0 = 7일',
    );
  });

  it('1.0 이 아닌 공간 유형과 흙은 보여 준다: 5.6 의 흑송 분재', () => {
    const pine: EnginePlant = {
      groupCode: 'bonsai_conifer',
      potSize: 'm',
      soilType: 'akadama',
      learnFactor: 1.0,
    };

    expect(formula(pine, { lightGrade: 'high', spaceType: 'terrace' }, 'heat')).toBe(
      '2일 × 폭염 0.5 × 중형 1.0 × 강광 0.8 × 테라스 0.7 × 적옥토 0.6 = 1일',
    );
  });

  it('5.6 의 겨울 몬스테라: 7 × 1.6 × 1.0 × 1.3 = 15일', () => {
    expect(formula(monstera, { lightGrade: 'low', spaceType: 'indoor_window' }, 'winter')).toBe(
      '7일 × 겨울 1.6 × 중형 1.0 × 약광 1.3 = 15일',
    );
  });

  it('소수 기본 주기와 발코니 확장', () => {
    const maple: EnginePlant = {
      groupCode: 'bonsai_deciduous',
      potSize: 'l',
      soilType: 'gritty',
      learnFactor: 1.0,
    };

    expect(formula(maple, { lightGrade: 'medium', spaceType: 'balcony_ext' }, 'spring')).toBe(
      '1.5일 × 봄 1.0 × 대형 1.3 × 중광 1.0 × 발코니 확장 0.9 × 마사 0.8 = 1일',
    );
  });

  it('수경과 수동 고정은 곱셈식 대신 고정 주기를 말한다', () => {
    expect(formula({ ...monstera, soilType: 'hydro' }, brightWindow, 'autumn')).toBe(
      '수경이라 7일마다 물을 갈아요',
    );
    expect(formula({ ...monstera, manualInterval: 10 }, brightWindow, 'autumn')).toBe(
      '직접 정한 주기 10일',
    );
  });
});

describe('숫자와 날짜 표기', () => {
  it('계수는 소수 첫째 자리까지는 늘 보이고 둘째 자리까지만 쓴다', () => {
    expect(formatFactor(1)).toBe('1.0');
    expect(formatFactor(1.3)).toBe('1.3');
    expect(formatFactor(1.15)).toBe('1.15');
    expect(formatFactor(0.765)).toBe('0.77');
    expect(formatFactor(2.5)).toBe('2.5');
  });

  it('날짜는 "9월 27일"', () => {
    expect(formatMonthDay({ year: 2026, month: 9, day: 27 })).toBe('9월 27일');
  });

  it('남은 일수는 D-day 로, 오늘은 D-0, 지났으면 밀린 일수로', () => {
    expect(formatDaysLeft(7)).toBe('D-7');
    expect(formatDaysLeft(0)).toBe('D-0');
    expect(formatDaysLeft(-3)).toBe('3일 밀림');
  });
});

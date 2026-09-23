import { describe, expect, it } from 'vitest';

import { computeInterval, DEFAULT_COEFFICIENTS } from '../engine';
import type { EnginePlant, EngineSpace } from '../engine';
import {
  formatDaysLeft,
  formatDottedDate,
  formatInterval,
  formatMonthDay,
  formatWeekday,
  plantCardLabel,
  speakDaysLeft,
} from './format';

const C = DEFAULT_COEFFICIENTS;

const monstera: EnginePlant = {
  groupCode: 'tropical',
  potSize: 'm',
  soilType: 'potting',
  learnFactor: 1.0,
};
const brightWindow: EngineSpace = { lightGrade: 'medium', spaceType: 'indoor_window' };

describe('formatInterval: 계산식 대신 결과만 말한다', () => {
  const interval = (plant: EnginePlant, season: 'autumn' | 'heat' = 'autumn') =>
    formatInterval(computeInterval(plant, brightWindow, season, C));

  it('며칠마다 물을 주는지', () => {
    expect(interval(monstera)).toBe('7일마다 물을 줘요');
    expect(interval({ ...monstera, learnFactor: 1.15 })).toBe('8일마다 물을 줘요');
  });

  it('직접 정한 주기도 같은 말로', () => {
    expect(interval({ ...monstera, manualInterval: 10 })).toBe('10일마다 물을 줘요');
  });

  it('하루 주기는 매일', () => {
    expect(interval({ ...monstera, groupCode: 'herb', potSize: 's' }, 'heat')).toBe('매일 물을 줘요');
  });

  it('수경은 물을 갈아 준다', () => {
    expect(interval({ ...monstera, soilType: 'hydro' })).toBe('7일마다 물을 갈아 줘요');
  });
});

describe('날짜 표기', () => {
  it('날짜는 "9월 27일"', () => {
    expect(formatMonthDay({ year: 2026, month: 9, day: 27 })).toBe('9월 27일');
  });

  it('남은 일수는 D-day 로, 물 줄 날은 "오늘", 지났으면 지난 일수로', () => {
    expect(formatDaysLeft(7)).toBe('D-7');
    expect(formatDaysLeft(0)).toBe('오늘');
    expect(formatDaysLeft(-3)).toBe('3일 지남');
  });

  it('오늘 탭의 큰 날짜는 "9.21", 요일은 한글로', () => {
    expect(formatDottedDate({ year: 2026, month: 9, day: 21 })).toBe('9.21');
    expect(formatWeekday({ year: 2026, month: 9, day: 21 })).toBe('월요일');
    expect(formatWeekday({ year: 2026, month: 9, day: 27 })).toBe('일요일');
  });
});

describe('스크린리더가 읽을 말 (SPEC.md 15)', () => {
  it('남은 날은 D-3 대신 "3일 뒤"로 읽는다', () => {
    expect(speakDaysLeft(3)).toBe('3일 뒤');
    expect(speakDaysLeft(0)).toBe('오늘');
    expect(speakDaysLeft(-1)).toBe('1일 지남');
  });

  it('식물 카드는 이름과 자리, 남은 날을 한 번에 읽는다', () => {
    expect(plantCardLabel({ name: '곰솔', note: '남향 실내 창가', daysLeft: -1 })).toBe(
      '곰솔, 남향 실내 창가, 1일 지남',
    );
  });

  it('오늘 물 준 카드는 완료라고 읽는다', () => {
    expect(plantCardLabel({ name: '금귤', note: '9월 30일에 다시 줘요', daysLeft: 7, done: true })).toBe(
      '금귤, 9월 30일에 다시 줘요, 완료',
    );
  });
});

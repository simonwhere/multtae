import { describe, expect, it } from 'vitest';

import { addDays } from './calendar';
import { DEFAULT_COEFFICIENTS } from './defaults';
import { getSeason, getSeasonAt, nextSeasonChange } from './season';
import type { CalendarDate, Season, SeasonBounds, SeasonChange } from './types';

const BOUNDS = DEFAULT_COEFFICIENTS.seasonBounds;

const date = (year: number, month: number, day: number): CalendarDate => ({ year, month, day });

describe('getSeason: SPEC.md 5.2 계절 경계', () => {
  // 각 계절의 첫날과 마지막 날
  it.each<[number, number, Season]>([
    [3, 1, 'spring'],
    [6, 20, 'spring'],
    [6, 21, 'monsoon'],
    [7, 25, 'monsoon'],
    [7, 26, 'heat'],
    [8, 31, 'heat'],
    [9, 1, 'autumn'],
    [11, 15, 'autumn'],
    [11, 16, 'winter'],
    [12, 31, 'winter'],
    [1, 1, 'winter'],
    [2, 28, 'winter'],
  ])('%i월 %i일 → %s', (month, day, season) => {
    expect(getSeason({ month, day }, BOUNDS)).toBe(season);
  });

  it('윤년 2월 29일은 겨울이다', () => {
    expect(getSeason(date(2028, 2, 29), BOUNDS)).toBe('winter');
    expect(getSeason(date(2028, 3, 1), BOUNDS)).toBe('spring');
  });

  it('SPEC 작성일 2026년 9월 20일은 가을이다', () => {
    expect(getSeason(date(2026, 9, 20), BOUNDS)).toBe('autumn');
  });
});

describe('getSeason: 조정된 경계', () => {
  it('난방 시작을 11월 1일로 당기면 그날부터 겨울이다 (SPEC 7.3 수동 조정)', () => {
    const early: SeasonBounds = { ...BOUNDS, winter: { month: 11, day: 1 } };

    expect(getSeason({ month: 10, day: 31 }, early)).toBe('autumn');
    expect(getSeason({ month: 11, day: 1 }, early)).toBe('winter');
  });

  it('봄 시작을 3월 15일로 늦추면 3월 14일까지 겨울이다', () => {
    const late: SeasonBounds = { ...BOUNDS, spring: { month: 3, day: 15 } };

    expect(getSeason({ month: 3, day: 14 }, late)).toBe('winter');
    expect(getSeason({ month: 3, day: 15 }, late)).toBe('spring');
  });

  it('겨울이 1월에 시작해도 연초는 직전 계절이 이어진다', () => {
    const lateWinter: SeasonBounds = { ...BOUNDS, winter: { month: 1, day: 10 } };

    expect(getSeason({ month: 12, day: 31 }, lateWinter)).toBe('autumn');
    expect(getSeason({ month: 1, day: 9 }, lateWinter)).toBe('autumn');
    expect(getSeason({ month: 1, day: 10 }, lateWinter)).toBe('winter');
  });

  it('두 계절의 시작일이 같으면 앞 계절은 길이가 0 이다 (마른 장마)', () => {
    const noMonsoon: SeasonBounds = { ...BOUNDS, monsoon: { month: 7, day: 26 } };

    expect(getSeason({ month: 7, day: 25 }, noMonsoon)).toBe('spring');
    expect(getSeason({ month: 7, day: 26 }, noMonsoon)).toBe('heat');
  });
});

describe('getSeasonAt: 시각을 Asia/Seoul 날짜로 판정한다 (SPEC 15)', () => {
  it('11월 16일 0시(서울)에 겨울로 바뀐다 (SPEC 시나리오 C)', () => {
    // 서울 11월 15일 23:59:59.999
    expect(getSeasonAt(Date.UTC(2026, 10, 15, 14, 59, 59, 999), BOUNDS)).toBe('autumn');
    // 서울 11월 16일 00:00:00.000
    expect(getSeasonAt(Date.UTC(2026, 10, 15, 15, 0, 0, 0), BOUNDS)).toBe('winter');
  });

  it('UTC 날짜가 아니라 서울 날짜를 본다: UTC 2월 28일 15시는 서울 3월 1일', () => {
    expect(getSeasonAt(Date.UTC(2027, 1, 28, 14, 59, 59, 999), BOUNDS)).toBe('winter');
    expect(getSeasonAt(Date.UTC(2027, 1, 28, 15, 0), BOUNDS)).toBe('spring');
  });

  it('윤년에는 서울 2월 29일 하루가 더 겨울이다', () => {
    expect(getSeasonAt(Date.UTC(2028, 1, 28, 15, 0), BOUNDS)).toBe('winter');
    expect(getSeasonAt(Date.UTC(2028, 1, 29, 15, 0), BOUNDS)).toBe('spring');
  });
});

describe('nextSeasonChange', () => {
  it('가을 한가운데서는 11월 16일 겨울이 다음 전환이다', () => {
    expect(nextSeasonChange(date(2026, 9, 20), BOUNDS)).toEqual({
      season: 'winter',
      date: date(2026, 11, 16),
    });
  });

  it('전환 전날에는 바로 다음 날이 전환이다', () => {
    expect(nextSeasonChange(date(2026, 11, 15), BOUNDS)).toEqual({
      season: 'winter',
      date: date(2026, 11, 16),
    });
  });

  it('전환 당일은 이미 바뀐 뒤이므로 그다음 전환을 돌려준다', () => {
    expect(nextSeasonChange(date(2026, 11, 16), BOUNDS)).toEqual({
      season: 'spring',
      date: date(2027, 3, 1),
    });
  });

  it('해를 넘겨 찾는다', () => {
    expect(nextSeasonChange(date(2026, 12, 31), BOUNDS)).toEqual({
      season: 'spring',
      date: date(2027, 3, 1),
    });
  });

  it('윤년에도 봄은 3월 1일에 시작한다', () => {
    expect(nextSeasonChange(date(2028, 2, 10), BOUNDS)).toEqual({
      season: 'spring',
      date: date(2028, 3, 1),
    });
  });

  it('1년 동안 다섯 계절을 순서대로 지난다', () => {
    const changes: SeasonChange[] = [];
    let cursor = date(2026, 1, 1);
    for (let i = 0; i < 5; i += 1) {
      const change = nextSeasonChange(cursor, BOUNDS);
      if (!change) throw new Error('전환을 찾지 못했다');
      changes.push(change);
      cursor = change.date;
    }

    expect(changes).toEqual([
      { season: 'spring', date: date(2026, 3, 1) },
      { season: 'monsoon', date: date(2026, 6, 21) },
      { season: 'heat', date: date(2026, 7, 26) },
      { season: 'autumn', date: date(2026, 9, 1) },
      { season: 'winter', date: date(2026, 11, 16) },
    ]);
  });

  it('길이가 0 인 계절은 건너뛴다', () => {
    const noMonsoon: SeasonBounds = { ...BOUNDS, monsoon: { month: 7, day: 26 } };

    expect(nextSeasonChange(date(2026, 6, 1), noMonsoon)).toEqual({
      season: 'heat',
      date: date(2026, 7, 26),
    });
  });

  it('조정된 경계를 따른다', () => {
    const early: SeasonBounds = { ...BOUNDS, winter: { month: 11, day: 1 } };

    expect(nextSeasonChange(date(2026, 10, 20), early)).toEqual({
      season: 'winter',
      date: date(2026, 11, 1),
    });
  });

  it('모든 계절의 시작일이 같아 전환이 없으면 null 이다', () => {
    const sameDay = { month: 1, day: 1 };
    const frozen: SeasonBounds = {
      spring: sameDay,
      monsoon: sameDay,
      heat: sameDay,
      autumn: sameDay,
      winter: sameDay,
    };

    expect(nextSeasonChange(date(2026, 6, 1), frozen)).toBeNull();
  });

  it('getSeason 과 어긋나지 않는다: 3년 동안 계절이 바뀌는 날이 곧 전환일이다', () => {
    const start = date(2026, 1, 1);
    const observed: SeasonChange[] = [];
    for (let offset = 1; offset <= 365 * 3 + 1; offset += 1) {
      const today = addDays(start, offset);
      const season = getSeason(today, BOUNDS);
      if (season !== getSeason(addDays(today, -1), BOUNDS)) observed.push({ season, date: today });
    }

    const chained: SeasonChange[] = [];
    let cursor = start;
    while (chained.length < observed.length) {
      const change = nextSeasonChange(cursor, BOUNDS);
      if (!change) throw new Error('전환을 찾지 못했다');
      chained.push(change);
      cursor = change.date;
    }

    expect(observed).toHaveLength(15);
    expect(chained).toEqual(observed);
  });
});

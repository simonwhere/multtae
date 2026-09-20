import { describe, expect, it } from 'vitest';

import {
  addDays,
  diffDays,
  SEOUL_UTC_OFFSET_MINUTES,
  startOfDay,
  toCalendarDate,
  toSeoulDate,
} from './calendar';
import type { CalendarDate } from './types';

const date = (year: number, month: number, day: number): CalendarDate => ({ year, month, day });

describe('toCalendarDate', () => {
  it('오프셋 0 이면 UTC 날짜다', () => {
    expect(toCalendarDate(0, 0)).toEqual(date(1970, 1, 1));
    expect(toCalendarDate(Date.UTC(2026, 8, 20, 23, 59, 59, 999), 0)).toEqual(date(2026, 9, 20));
  });

  it('양수 오프셋은 날짜를 앞당긴다: UTC 15시는 서울 다음 날 0시', () => {
    const utc = Date.UTC(2026, 10, 15, 15, 0, 0, 0);

    expect(toCalendarDate(utc, 0)).toEqual(date(2026, 11, 15));
    expect(toCalendarDate(utc, 540)).toEqual(date(2026, 11, 16));
  });

  it('음수 오프셋은 날짜를 늦춘다: UTC 1월 1일 03시는 뉴욕(−5시간) 12월 31일', () => {
    expect(toCalendarDate(Date.UTC(2026, 0, 1, 3, 0), -300)).toEqual(date(2025, 12, 31));
  });
});

describe('toSeoulDate: Asia/Seoul(UTC+9, 서머타임 없음) 달력', () => {
  it('오프셋은 540분이다', () => {
    expect(SEOUL_UTC_OFFSET_MINUTES).toBe(540);
  });

  it('자정 직전과 자정 (SPEC 15 자정 전후 경계)', () => {
    // 서울 11월 15일 23:59:59.999
    expect(toSeoulDate(Date.UTC(2026, 10, 15, 14, 59, 59, 999))).toEqual(date(2026, 11, 15));
    // 서울 11월 16일 00:00:00.000
    expect(toSeoulDate(Date.UTC(2026, 10, 15, 15, 0, 0, 0))).toEqual(date(2026, 11, 16));
  });

  it('해가 바뀌는 자정', () => {
    expect(toSeoulDate(Date.UTC(2026, 11, 31, 14, 59, 59, 999))).toEqual(date(2026, 12, 31));
    expect(toSeoulDate(Date.UTC(2026, 11, 31, 15, 0))).toEqual(date(2027, 1, 1));
  });

  it('윤년 2월 29일', () => {
    expect(toSeoulDate(Date.UTC(2028, 1, 28, 15, 0))).toEqual(date(2028, 2, 29));
    expect(toSeoulDate(Date.UTC(2028, 1, 29, 15, 0))).toEqual(date(2028, 3, 1));
  });
});

describe('startOfDay', () => {
  it('그 날짜 0시의 시각을 돌려준다', () => {
    expect(startOfDay(date(2026, 11, 16), 0)).toBe(Date.UTC(2026, 10, 16));
    expect(startOfDay(date(2026, 11, 16), SEOUL_UTC_OFFSET_MINUTES)).toBe(
      Date.UTC(2026, 10, 15, 15, 0),
    );
    expect(startOfDay(date(2026, 1, 1), -300)).toBe(Date.UTC(2026, 0, 1, 5, 0));
  });

  it('toCalendarDate 와 서로 되돌린다', () => {
    const day = date(2028, 2, 29);
    const start = startOfDay(day, SEOUL_UTC_OFFSET_MINUTES);

    expect(toSeoulDate(start)).toEqual(day);
    expect(toSeoulDate(start - 1)).toEqual(date(2028, 2, 28));
    expect(toSeoulDate(start + 86_400_000 - 1)).toEqual(day);
    expect(toSeoulDate(start + 86_400_000)).toEqual(date(2028, 3, 1));
  });
});

describe('addDays', () => {
  it('같은 달 안에서 더한다', () => {
    // SPEC 시나리오 A: 9월 20일 + 7일 = 9월 27일
    expect(addDays(date(2026, 9, 20), 7)).toEqual(date(2026, 9, 27));
  });

  it('0일이면 같은 날이다', () => {
    expect(addDays(date(2026, 9, 20), 0)).toEqual(date(2026, 9, 20));
  });

  it('달을 넘긴다', () => {
    expect(addDays(date(2026, 1, 31), 1)).toEqual(date(2026, 2, 1));
    expect(addDays(date(2026, 9, 27), 9)).toEqual(date(2026, 10, 6));
  });

  it('해를 넘긴다', () => {
    expect(addDays(date(2026, 12, 31), 1)).toEqual(date(2027, 1, 1));
    expect(addDays(date(2026, 12, 20), 60)).toEqual(date(2027, 2, 18));
  });

  it('윤년에만 2월 29일이 있다', () => {
    expect(addDays(date(2028, 2, 28), 1)).toEqual(date(2028, 2, 29));
    expect(addDays(date(2027, 2, 28), 1)).toEqual(date(2027, 3, 1));
  });

  it('음수면 과거로 간다', () => {
    expect(addDays(date(2026, 3, 1), -1)).toEqual(date(2026, 2, 28));
    expect(addDays(date(2028, 3, 1), -1)).toEqual(date(2028, 2, 29));
    expect(addDays(date(2027, 1, 1), -1)).toEqual(date(2026, 12, 31));
  });
});

describe('diffDays', () => {
  it('같은 날은 0', () => {
    expect(diffDays(date(2026, 9, 20), date(2026, 9, 20))).toBe(0);
  });

  it('뒤 날짜가 미래면 양수 (D-day), 과거면 음수 (밀린 일수)', () => {
    expect(diffDays(date(2026, 9, 20), date(2026, 9, 27))).toBe(7);
    expect(diffDays(date(2026, 9, 27), date(2026, 9, 24))).toBe(-3);
  });

  it('달·해·윤일을 넘겨 센다', () => {
    expect(diffDays(date(2026, 12, 28), date(2027, 1, 12))).toBe(15);
    expect(diffDays(date(2028, 2, 28), date(2028, 3, 1))).toBe(2);
    expect(diffDays(date(2027, 2, 28), date(2027, 3, 1))).toBe(1);
    expect(diffDays(date(2027, 1, 1), date(2028, 1, 1))).toBe(365);
    expect(diffDays(date(2028, 1, 1), date(2029, 1, 1))).toBe(366);
  });

  it('addDays 와 서로 되돌린다', () => {
    const from = date(2026, 11, 10);

    for (const days of [1, 9, 15, 60, 400]) {
      expect(diffDays(from, addDays(from, days))).toBe(days);
    }
  });
});

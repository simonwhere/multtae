import { describe, expect, it } from 'vitest';

import { msUntilNextDay } from './day-boundary';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
/** 그 시간대의 벽시계 시각을 epoch ms 로 */
const wall = (offsetMinutes: number, hour: number, minute = 0) =>
  Date.UTC(2026, 8, 23, hour, minute) - offsetMinutes * 60_000;

describe('msUntilNextDay: 자정까지 남은 시간 (SPEC.md 15 시간)', () => {
  it.each([
    { name: '서울', offset: 540 },
    { name: '로스앤젤레스', offset: -480 },
    { name: '런던', offset: 0 },
    { name: '오클랜드', offset: 780 },
    { name: '카트만두(45분 단위)', offset: 345 },
  ])('$name: 밤 11시 30분이면 30분 남는다', ({ offset }) => {
    expect(msUntilNextDay(wall(offset, 23, 30), offset)).toBe(30 * 60 * 1000);
  });

  it('자정 정각이면 하루를 통째로 기다린다. 0 이면 타이머가 곧바로 되풀이된다', () => {
    expect(msUntilNextDay(wall(540, 0), 540)).toBe(DAY);
  });

  it('정오면 열두 시간 남는다', () => {
    expect(msUntilNextDay(wall(540, 12), 540)).toBe(12 * HOUR);
  });
});

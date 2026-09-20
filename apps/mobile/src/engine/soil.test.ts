import { describe, expect, it } from 'vitest';

import { getSoilGaugeState } from './soil';
import type { CalendarDate } from './types';

const date = (year: number, month: number, day: number): CalendarDate => ({ year, month, day });

describe('getSoilGaugeState: 흙 게이지의 진행률 (SPEC.md 14.1)', () => {
  // 시나리오 A: 9월 20일에 물을 주고 7일 주기라 9월 27일이 다음 물주기
  const lastWatered = date(2026, 9, 20);
  const nextWater = date(2026, 9, 27);

  it('물 준 날은 전부 젖어 있다', () => {
    expect(getSoilGaugeState(lastWatered, nextWater, date(2026, 9, 20))).toEqual({
      status: 'moist',
      moisture: 1,
      daysLeft: 7,
    });
  });

  it('날이 갈수록 젖은 영역이 줄어든다', () => {
    const day3 = getSoilGaugeState(lastWatered, nextWater, date(2026, 9, 23));
    const day6 = getSoilGaugeState(lastWatered, nextWater, date(2026, 9, 26));

    expect(day3).toMatchObject({ status: 'moist', daysLeft: 4 });
    expect(day3.moisture).toBeCloseTo(4 / 7, 10);
    expect(day6).toMatchObject({ status: 'moist', daysLeft: 1 });
    expect(day6.moisture).toBeCloseTo(1 / 7, 10);
  });

  it('물 줄 날에는 전부 말라 있다', () => {
    expect(getSoilGaugeState(lastWatered, nextWater, date(2026, 9, 27))).toEqual({
      status: 'due',
      moisture: 0,
      daysLeft: 0,
    });
  });

  it('예정일이 지나면 밀림이고 daysLeft 는 밀린 일수만큼 음수다', () => {
    expect(getSoilGaugeState(lastWatered, nextWater, date(2026, 9, 30))).toEqual({
      status: 'overdue',
      moisture: 0,
      daysLeft: -3,
    });
  });

  it('달을 넘겨도 센다', () => {
    const state = getSoilGaugeState(date(2026, 12, 28), date(2027, 1, 12), date(2027, 1, 2));

    expect(state).toMatchObject({ status: 'moist', daysLeft: 10 });
    expect(state.moisture).toBeCloseTo(10 / 15, 10);
  });

  it('분재처럼 1일 주기면 하루 만에 마른다', () => {
    const watered = date(2026, 8, 1);
    const next = date(2026, 8, 2);

    expect(getSoilGaugeState(watered, next, date(2026, 8, 1))).toMatchObject({
      status: 'moist',
      moisture: 1,
    });
    expect(getSoilGaugeState(watered, next, date(2026, 8, 2))).toMatchObject({
      status: 'due',
      moisture: 0,
    });
  });

  it('"내일로" 미뤄 예정일이 늘어나면 그만큼 다시 젖은 쪽으로 간다', () => {
    const postponed = getSoilGaugeState(lastWatered, date(2026, 9, 28), date(2026, 9, 27));

    expect(postponed).toMatchObject({ status: 'moist', daysLeft: 1 });
    expect(postponed.moisture).toBeCloseTo(1 / 8, 10);
  });

  it('기기 날짜가 물 준 날보다 앞서도 1 을 넘지 않는다', () => {
    expect(getSoilGaugeState(lastWatered, nextWater, date(2026, 9, 18))).toEqual({
      status: 'moist',
      moisture: 1,
      daysLeft: 9,
    });
  });

  it('예정일이 물 준 날과 같거나 앞선 잘못된 데이터도 0~1 안에 든다', () => {
    const state = getSoilGaugeState(lastWatered, date(2026, 9, 19), date(2026, 9, 18));

    expect(state).toEqual({ status: 'moist', moisture: 1, daysLeft: 1 });
  });
});

import { describe, expect, it } from 'vitest';

import type { Plant } from '../db/schema';
import { DEFAULT_COEFFICIENTS } from '../engine';
import type { CalendarDate, EngineSpace, Season } from '../engine';
import { planReschedule, waterDateAsOf } from './schedule';

const C = DEFAULT_COEFFICIENTS;
const KST = 540;
/** 기기 시간대(KST)의 그 날짜 몇 시 */
const at = (month: number, day: number, hour = 0) => Date.UTC(2026, month - 1, day, hour - 9);
const date = (month: number, day: number): CalendarDate => ({ year: 2026, month, day });

const window: EngineSpace = { lightGrade: 'medium', spaceType: 'indoor_window' };

function plant(patch: Partial<Plant>): Plant {
  return {
    id: 'plant-1',
    spaceId: 'space-1',
    scientificName: 'Monstera deliciosa',
    nickname: '몬스테라',
    groupCode: 'tropical',
    potSize: 'm',
    soilType: 'potting',
    isBonsai: false,
    bonsaiGroup: null,
    learnFactor: 1.0,
    manualInterval: null,
    lastWateredAt: at(11, 10, 12),
    lastWateredUnknown: false,
    nextWaterAt: at(11, 17),
    lastRepotAt: null,
    postponeCount: 0,
    coverPhotoPath: null,
    createdAt: 1,
    ...patch,
  };
}

const on = (today: CalendarDate, season: Season) => ({
  today,
  season,
  coefficients: C,
  utcOffsetMinutes: KST,
});

describe('planReschedule: 다음 물주기를 지금의 계절·계수로 다시 센다 (SPEC.md 시나리오 C, 5.5)', () => {
  it('바뀐 것이 없으면 고치지 않는다', () => {
    // 가을 7일: 11월 10일 + 7일 = 11월 17일
    expect(planReschedule(plant({}), window, on(date(11, 12), 'autumn'))).toBeNull();
  });

  it('시나리오 C: 11월 16일 겨울이 되면 몬스테라는 7 × 1.6 = 11일 주기로 늘어난다', () => {
    const patch = planReschedule(plant({}), window, on(date(11, 16), 'winter'));

    expect(patch).toEqual({ nextWaterAt: at(11, 21) });
  });

  it('시나리오 C: 다육이는 2.5배로 늘어 12월까지 물을 주지 않아도 된다', () => {
    const echeveria = plant({
      scientificName: 'Echeveria elegans',
      groupCode: 'succulent',
      nextWaterAt: at(11, 24),
    });

    // 14 × 2.5 = 35일
    expect(planReschedule(echeveria, window, on(date(11, 16), 'winter'))).toEqual({
      nextWaterAt: at(12, 15),
    });
  });

  it('주기가 짧아지면 다음 물주기가 당겨진다: 폭염 7 × 0.7 = 5일', () => {
    // 장마 9일: 7월 23일 + 9일 = 8월 1일 → 폭염 5일: 7월 28일
    const late = plant({ lastWateredAt: at(7, 23, 12), nextWaterAt: at(8, 1) });

    expect(planReschedule(late, window, on(date(7, 26), 'heat'))).toEqual({
      nextWaterAt: at(7, 28),
    });
  });

  it('당겨진 날짜가 이미 지났으면 오늘로 둔다. 계절이 바뀌자마자 밀림이 되지는 않는다', () => {
    // 7월 20일 + 5일 = 7월 25일은 어제다
    const dueSoon = plant({ lastWateredAt: at(7, 20, 12), nextWaterAt: at(7, 29) });
    const patch = planReschedule(dueSoon, window, on(date(7, 26), 'heat'));

    expect(patch).toEqual({ nextWaterAt: at(7, 26) });
    // 오늘로 옮긴 뒤에는 다시 고치지 않는다
    expect(
      planReschedule({ ...dueSoon, ...patch }, window, on(date(7, 26), 'heat')),
    ).toBeNull();
  });

  it('이미 밀린 식물은 그대로 둔다. 지난 계절에 마른 흙을 새 주기만큼 더 기다리게 하지 않는다', () => {
    const overdue = plant({ lastWateredAt: at(11, 8, 12), nextWaterAt: at(11, 15) });

    expect(planReschedule(overdue, window, on(date(11, 16), 'winter'))).toBeNull();
  });

  it('오늘 물 줄 식물은 다시 센다', () => {
    const dueToday = plant({ lastWateredAt: at(11, 9, 12), nextWaterAt: at(11, 16) });

    expect(planReschedule(dueToday, window, on(date(11, 16), 'winter'))).toEqual({
      nextWaterAt: at(11, 20),
    });
  });

  it('"내일로"로 미룬 식물은 그대로 둔다. 사용자가 정한 날이다', () => {
    const postponed = plant({
      lastWateredAt: at(11, 9, 12),
      nextWaterAt: at(11, 17),
      postponeCount: 1,
    });

    expect(planReschedule(postponed, window, on(date(11, 16), 'winter'))).toBeNull();
  });

  it('마지막 물 준 날을 모르는 식물은 절반 주기로 다시 센다 (5.5)', () => {
    // 가을 7 / 2 = 3.5 → 4일: 11월 14일 + 4일 = 11월 18일
    const unknown = plant({
      lastWateredAt: at(11, 14, 12),
      lastWateredUnknown: true,
      nextWaterAt: at(11, 18),
    });

    expect(planReschedule(unknown, window, on(date(11, 15), 'autumn'))).toBeNull();
    // 겨울 11.2 / 2 = 5.6 → 6일
    expect(planReschedule(unknown, window, on(date(11, 16), 'winter'))).toEqual({
      nextWaterAt: at(11, 20),
    });
  });

  it('공간의 빛이 바뀌어도 다시 센다: 약광 7 × 1.3 = 9일', () => {
    const dim: EngineSpace = { lightGrade: 'low', spaceType: 'indoor_window' };

    expect(planReschedule(plant({}), dim, on(date(11, 12), 'autumn'))).toEqual({
      nextWaterAt: at(11, 19),
    });
  });

  it('수경과 수동 고정은 계절이 바뀌어도 그대로다', () => {
    const hydro = plant({ soilType: 'hydro' });
    const manual = plant({ manualInterval: 10, nextWaterAt: at(11, 20) });

    expect(planReschedule(hydro, window, on(date(11, 16), 'winter'))).toBeNull();
    expect(planReschedule(manual, window, on(date(11, 16), 'winter'))).toBeNull();
  });

  it('다음 물주기가 비어 있으면 채운다', () => {
    const blank = plant({ nextWaterAt: null });

    expect(planReschedule(blank, window, on(date(11, 12), 'autumn'))).toEqual({
      nextWaterAt: at(11, 17),
    });
  });

  it('같은 날짜면 저장된 시각이 자정이 아니어도 고치지 않는다', () => {
    const noon = plant({ nextWaterAt: at(11, 17, 12) });

    expect(planReschedule(noon, window, on(date(11, 12), 'autumn'))).toBeNull();
  });

  it('입력으로 받은 식물을 바꾸지 않는다', () => {
    const frozen = Object.freeze(plant({}));

    expect(() => planReschedule(frozen, window, on(date(11, 16), 'winter'))).not.toThrow();
    expect(frozen.nextWaterAt).toBe(at(11, 17));
  });
});

describe('waterDateAsOf: 그날 그 계절이라면 다음 물주기는 언제인가', () => {
  it('알림을 미리 짤 때 쓴다: 전환일 기준으로 새 계절의 날짜를 본다', () => {
    expect(waterDateAsOf(plant({}), window, on(date(11, 16), 'winter'))).toEqual(date(11, 21));
  });

  it('전환일 전에 예정된 식물은 저장된 날짜 그대로다', () => {
    const early = plant({ lastWateredAt: at(11, 7, 12), nextWaterAt: at(11, 14) });

    expect(waterDateAsOf(early, window, on(date(11, 16), 'winter'))).toEqual(date(11, 14));
  });
});

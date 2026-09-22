import { describe, expect, it } from 'vitest';

import type { Plant, Space } from '../db/schema';
import { DEFAULT_COEFFICIENTS } from '../engine';
import {
  canApplyWateringHint,
  feedbackStreak,
  MAX_MANUAL_DAYS,
  needsSeasonQuestion,
  planKeepManual,
  planManualInterval,
  planMove,
  planRename,
  planRepot,
  planWateringHint,
} from './care';

const C = DEFAULT_COEFFICIENTS;
const KST = 540;
/** 기기 시간대(KST)의 그 날짜 몇 시 */
const at = (month: number, day: number, hour = 0) => Date.UTC(2026, month - 1, day, hour - 9);

// 2026-09-24 10:00 KST
const NOW = at(9, 24, 10);
const context = { now: NOW, utcOffsetMinutes: KST, season: 'autumn' as const, coefficients: C };

const space = (patch: Partial<Space>): Space => ({
  id: 'space-1',
  name: '남향 거실 창가',
  photoPath: null,
  direction: 'S',
  spaceType: 'indoor_window',
  lightGrade: 'medium',
  lightSource: 'default',
  aiEvidence: null,
  createdAt: 1,
  ...patch,
});

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
    learnFactor: 1.15,
    baseInterval: 7,
    manualInterval: null,
    manualSeason: null,
    lastWateredAt: at(9, 20, 12),
    lastWateredUnknown: false,
    // 7 × 1.15 = 8.05 → 8일
    nextWaterAt: at(9, 28),
    lastRepotAt: null,
    postponeCount: 0,
    coverPhotoPath: null,
    createdAt: 1,
    ...patch,
  };
}

describe('planManualInterval: 주기 직접 정하기와 되돌리기 (SPEC.md 5.5)', () => {
  it('직접 정하면 계산 대신 그 일수로 다음 물주기를 다시 센다', () => {
    expect(planManualInterval(plant({}), space({}), 10, context)).toEqual({
      manualInterval: 10,
      manualSeason: 'autumn',
      nextWaterAt: at(9, 30),
    });
  });

  it('자동으로 되돌리면 지금의 계산으로 다시 센다. 배운 보정은 그대로다', () => {
    const fixed = plant({ manualInterval: 10, manualSeason: 'autumn', nextWaterAt: at(9, 30) });

    expect(planManualInterval(fixed, space({}), null, context)).toEqual({
      manualInterval: null,
      manualSeason: null,
      nextWaterAt: at(9, 28),
    });
  });

  it(`1일에서 ${MAX_MANUAL_DAYS}일 사이의 정수로 맞춘다`, () => {
    expect(planManualInterval(plant({}), space({}), 0, context).manualInterval).toBe(1);
    expect(planManualInterval(plant({}), space({}), 99, context).manualInterval).toBe(60);
    expect(planManualInterval(plant({}), space({}), 6.6, context).manualInterval).toBe(7);
  });

  it('새 날짜가 이미 지났으면 오늘로 둔다. 밀린 식물도 직접 고치면 바로 다시 센다', () => {
    const overdue = plant({ lastWateredAt: at(9, 10, 12), nextWaterAt: at(9, 18) });

    expect(planManualInterval(overdue, space({}), 5, context).nextWaterAt).toBe(at(9, 24));
    expect(planManualInterval(overdue, space({}), 30, context).nextWaterAt).toBe(at(10, 10));
  });
});

describe('계절이 바뀌면 직접 정한 주기를 한 번 묻는다 (SPEC.md 5.5)', () => {
  it('직접 정한 뒤 계절이 바뀌었을 때만 묻는다', () => {
    const fixed = plant({ manualInterval: 10, manualSeason: 'autumn' });

    expect(needsSeasonQuestion(fixed, 'autumn')).toBe(false);
    expect(needsSeasonQuestion(fixed, 'winter')).toBe(true);
    expect(needsSeasonQuestion(plant({}), 'winter')).toBe(false);
  });

  it('그대로 두겠다고 답하면 이번 계절에는 다시 묻지 않는다', () => {
    const fixed = plant({ manualInterval: 10, manualSeason: 'autumn' });
    const kept = { ...fixed, ...planKeepManual({ ...context, season: 'winter' }) };

    expect(kept.manualInterval).toBe(10);
    expect(needsSeasonQuestion(kept, 'winter')).toBe(false);
  });
});

describe('planRepot: 분갈이 (SPEC.md 5.5)', () => {
  it('화분과 흙을 바꾸면 다시 세고, 배운 보정은 처음으로 돌린다', () => {
    const plan = planRepot(plant({}), space({}), { potSize: 'l', soilType: 'gritty' }, {
      ...context,
      eventId: 'event-1',
    });

    // 7 × 대형 1.3 × 마사 0.8 × U 1.0 = 7.28 → 7일
    expect(plan.patch).toEqual({
      potSize: 'l',
      soilType: 'gritty',
      learnFactor: 1.0,
      lastRepotAt: NOW,
      nextWaterAt: at(9, 27),
    });
    expect(plan.event).toEqual({
      id: 'event-1',
      plantId: 'plant-1',
      type: 'repot',
      occurredAt: NOW,
      payload: { potSize: 'l', soilType: 'gritty' },
    });
  });

  it('직접 정한 주기는 분갈이를 해도 그대로다', () => {
    const fixed = plant({ manualInterval: 10, manualSeason: 'autumn', nextWaterAt: at(9, 30) });
    const plan = planRepot(fixed, space({}), { potSize: 's', soilType: 'potting' }, {
      ...context,
      eventId: 'event-1',
    });

    expect(plan.patch).toMatchObject({ potSize: 's', learnFactor: 1.0, nextWaterAt: at(9, 30) });
  });
});

describe('planMove: 공간 이동 (SPEC.md 5.5)', () => {
  it('옮긴 공간의 빛으로 바로 다시 센다. 배운 보정은 그대로다', () => {
    const dim = space({ id: 'space-2', name: '북향 방', lightGrade: 'low' });
    const plan = planMove(plant({}), dim, { ...context, eventId: 'event-2' });

    // 7 × 약광 1.3 × U 1.15 = 10.465 → 10일
    expect(plan?.patch).toEqual({ spaceId: 'space-2', nextWaterAt: at(9, 30) });
    expect(plan?.event).toMatchObject({
      type: 'move',
      payload: { fromSpaceId: 'space-1', toSpaceId: 'space-2' },
    });
  });

  it('같은 공간이면 아무것도 하지 않는다', () => {
    expect(planMove(plant({}), space({}), { ...context, eventId: 'event-2' })).toBeNull();
  });
});

describe('planRename: 별명', () => {
  it('앞뒤 공백을 떼고, 비었거나 20자를 넘으면 받지 않는다', () => {
    expect(planRename('  거실 몬스테라 ')).toBe('거실 몬스테라');
    expect(planRename('   ')).toBeNull();
    expect(planRename('가'.repeat(21))).toBeNull();
    expect(planRename('가'.repeat(20))).toBe('가'.repeat(20));
  });
});

describe('feedbackStreak: 같은 흙 상태가 세 번 이어지면 알린다 (SPEC.md 5.4)', () => {
  const logs = (...states: ('dry' | 'ok' | 'wet' | 'skipped')[]) =>
    // 최근 기록부터
    states.map((soilState, index) => ({ soilState, wateredAt: at(9, 20 - index * 7, 9) }));

  it('축축했어요가 세 번 이어지면 물을 덜 원하는 식물이다', () => {
    expect(feedbackStreak(plant({}), logs('wet', 'wet', 'wet', 'dry'), C)).toBe('wet');
    expect(feedbackStreak(plant({}), logs('dry', 'dry', 'dry'), C)).toBe('dry');
  });

  it('두 번이거나 중간에 다른 답이 끼면 알리지 않는다', () => {
    expect(feedbackStreak(plant({}), logs('wet', 'wet'), C)).toBeNull();
    expect(feedbackStreak(plant({}), logs('wet', 'ok', 'wet', 'wet'), C)).toBeNull();
    expect(feedbackStreak(plant({}), logs('ok', 'ok', 'ok'), C)).toBeNull();
  });

  it('흙 상태를 고르지 않은 기록은 건너뛰고 센다', () => {
    expect(feedbackStreak(plant({}), logs('wet', 'skipped', 'wet', 'wet'), C)).toBe('wet');
  });

  it('분갈이 전의 기록은 세지 않는다. 흙이 바뀌었다', () => {
    const repotted = plant({ lastRepotAt: at(9, 10) });

    expect(feedbackStreak(repotted, logs('wet', 'wet', 'wet'), C)).toBeNull();
  });

  it('주기를 직접 정했거나 수경이면 알리지 않는다', () => {
    expect(feedbackStreak(plant({ manualInterval: 10 }), logs('wet', 'wet', 'wet'), C)).toBeNull();
    expect(feedbackStreak(plant({ soilType: 'hydro' }), logs('wet', 'wet', 'wet'), C)).toBeNull();
  });
});

describe('planWateringHint: 진단의 물주기 판단 반영 (SPEC.md 8.1)', () => {
  const window = space({});

  it('너무 자주 줬으면 간격을 늘리고, 드물게 줬으면 줄인다', () => {
    const over = planWateringHint(plant({ learnFactor: 1 }), window, 'over', context);
    const under = planWateringHint(plant({ learnFactor: 1 }), window, 'under', context);

    expect(over?.learnFactor).toBeCloseTo(1.15, 10);
    expect(under?.learnFactor).toBeCloseTo(0.85, 10);
    expect(over?.nextWaterAt ?? 0).toBeGreaterThan(under?.nextWaterAt ?? 0);
  });

  it('직접 정한 주기나 수경, 판단이 없으면 묻지 않는다', () => {
    expect(canApplyWateringHint(plant({ manualInterval: 5 }), 'over')).toBe(false);
    expect(canApplyWateringHint(plant({ soilType: 'hydro' }), 'over')).toBe(false);
    expect(canApplyWateringHint(plant({}), 'none')).toBe(false);
    expect(canApplyWateringHint(plant({}), 'under')).toBe(true);
    expect(planWateringHint(plant({ manualInterval: 5 }), window, 'over', context)).toBeNull();
  });
});

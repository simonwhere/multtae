import { describe, expect, it } from 'vitest';

import type { PlantWithSpace } from '../db/plants';
import type { Plant, Space } from '../db/schema';
import { DEFAULT_COEFFICIENTS } from '../engine';
import { classifyToday, planPostpone, planWatering, toEnginePlant, UPCOMING_DAYS } from './today';

const C = DEFAULT_COEFFICIENTS;
const KST = 540;
/** 기기 시간대(KST)의 그 날짜 몇 시 */
const at = (month: number, day: number, hour = 0) => Date.UTC(2026, month - 1, day, hour - 9);

// 2026-09-27 08:30 KST. 시나리오 B 의 물 주는 날 아침
const NOW = at(9, 27, 8) + 30 * 60_000;

const livingRoom: Space = {
  id: 'space-1',
  name: '남향 거실 창가',
  photoPath: null,
  direction: 'S',
  spaceType: 'indoor_window',
  lightGrade: 'medium',
  lightSource: 'default',
  aiEvidence: null,
  createdAt: 1,
};

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
    lastWateredAt: at(9, 20, 12),
    lastWateredUnknown: false,
    nextWaterAt: at(9, 27),
    lastRepotAt: null,
    postponeCount: 0,
    coverPhotoPath: null,
    createdAt: 1,
    ...patch,
  };
}

const item = (patch: Partial<Plant>): PlantWithSpace => ({ plant: plant(patch), space: livingRoom });
const context = { now: NOW, utcOffsetMinutes: KST, season: 'autumn' as const, coefficients: C };

describe('classifyToday: 오늘 탭의 구역 (SPEC.md 3.2)', () => {
  const sections = classifyToday(
    [
      item({ id: 'due', nextWaterAt: at(9, 27) }),
      item({ id: 'late-1', nextWaterAt: at(9, 26) }),
      item({ id: 'late-5', nextWaterAt: at(9, 22) }),
      item({ id: 'soon-3', nextWaterAt: at(9, 30) }),
      item({ id: 'soon-1', nextWaterAt: at(9, 28) }),
      item({ id: 'far', nextWaterAt: at(10, 1) }),
      item({ id: 'done', lastWateredAt: at(9, 27, 12), nextWaterAt: at(9, 29) }),
      item({
        id: 'new-unknown',
        lastWateredAt: at(9, 27, 12),
        lastWateredUnknown: true,
        nextWaterAt: at(9, 29),
      }),
    ],
    NOW,
    KST,
  );
  const ids = (list: { plant: Plant }[]) => list.map((entry) => entry.plant.id);

  it('밀림: 예정일이 지난 식물. 많이 밀린 것부터', () => {
    expect(ids(sections.overdue)).toEqual(['late-5', 'late-1']);
    expect(sections.overdue[0].soil).toMatchObject({ status: 'overdue', daysLeft: -5 });
  });

  it('오늘: 오늘 물 줄 식물', () => {
    expect(ids(sections.due)).toEqual(['due']);
  });

  it(`다가옴: ${UPCOMING_DAYS}일 안에 예정된 식물. 가까운 것부터`, () => {
    expect(ids(sections.upcoming)).toEqual(['soon-1', 'new-unknown', 'soon-3']);
  });

  it('오늘 물 준 식물은 완료로 따로 모은다. 물 준 날을 모르는 채 오늘 등록한 식물은 아니다', () => {
    expect(ids(sections.done)).toEqual(['done']);
  });

  it('더 먼 예정은 오늘 탭에 나오지 않는다', () => {
    const shown = [...sections.overdue, ...sections.due, ...sections.upcoming, ...sections.done];
    expect(ids(shown)).not.toContain('far');
  });

  it('자정을 넘기면 어제 예정이던 식물이 밀림이 된다', () => {
    const tomorrow = classifyToday([item({ id: 'due', nextWaterAt: at(9, 27) })], at(9, 28, 0), KST);

    expect(ids(tomorrow.overdue)).toEqual(['due']);
  });
});

describe('toEnginePlant: 저장된 식물을 엔진 입력으로', () => {
  it('시드 종의 종별 기본 주기를 붙인다', () => {
    const zz = toEnginePlant(plant({ scientificName: 'Zamioculcas zamiifolia', groupCode: 'temperate' }));

    expect(zz).toMatchObject({ groupCode: 'temperate', baseInterval: 14, learnFactor: 1.0 });
  });

  it('종을 모르거나 개별 주기가 없는 종은 식물군 기본값을 쓴다', () => {
    expect(toEnginePlant(plant({ scientificName: null })).baseInterval).toBeNull();
    expect(toEnginePlant(plant({ scientificName: 'Epipremnum aureum' })).baseInterval).toBeNull();
  });

  it('일반 종을 분재로 키우면 종별 주기를 쓰지 않는다', () => {
    const bonsaiZz = plant({
      scientificName: 'Zamioculcas zamiifolia',
      groupCode: 'bonsai_deciduous',
      isBonsai: true,
      bonsaiGroup: 'deciduous',
    });

    expect(toEnginePlant(bonsaiZz).baseInterval).toBeNull();
  });
});

describe('planWatering: 물 줬어요 (SPEC.md 3.2, 5.4, 5.5)', () => {
  const water = (target: Plant, soilState: 'dry' | 'ok' | 'wet' | 'skipped', leafDroop = false) =>
    planWatering(target, livingRoom, { soilState, leafDroop }, { ...context, logId: 'log-1' });

  it('시나리오 B: "아직 축축했어요" → 주기 +15% → 다음 물주기는 8일 뒤', () => {
    const plan = water(plant({}), 'wet');

    expect(plan.plantPatch).toEqual({
      learnFactor: 1.15,
      lastWateredAt: at(9, 27, 12),
      lastWateredUnknown: false,
      nextWaterAt: at(10, 5),
      postponeCount: 0,
    });
    expect(plan.result.days).toBe(8);
  });

  it('물주기 기록에는 흙 상태와, 이때 새로 계산한 주기·계수를 남긴다', () => {
    const { log } = water(plant({}), 'wet');

    expect(log).toMatchObject({
      id: 'log-1',
      plantId: 'plant-1',
      wateredAt: NOW,
      soilState: 'wet',
      leafDroop: false,
      source: 'user',
    });
    expect(log.intervalCalc).toBeCloseTo(8.05, 6);
    expect(log.factorSnapshot).toMatchObject({ base: 7, season: 1.0, learn: 1.15 });
  });

  it('적당했음과 건너뜀은 U 를 그대로 둔다', () => {
    expect(water(plant({ learnFactor: 1.2 }), 'ok').plantPatch.learnFactor).toBe(1.2);
    expect(water(plant({ learnFactor: 1.2 }), 'skipped').plantPatch.learnFactor).toBe(1.2);
    expect(water(plant({}), 'skipped').log.soilState).toBe('skipped');
  });

  it('바싹 말랐음 + 잎 처짐은 0.765 배, 다음 물주기는 7 × 0.765 = 5.4 → 5일 뒤', () => {
    const plan = water(plant({}), 'dry', true);

    expect(plan.plantPatch.learnFactor).toBeCloseTo(0.765, 10);
    expect(plan.plantPatch.nextWaterAt).toBe(at(10, 2));
    expect(plan.log).toMatchObject({ soilState: 'dry', leafDroop: true });
  });

  it('밀린 식물에 물을 주면 오늘부터 다시 세고, 밀린 일수는 학습에 반영하지 않는다', () => {
    const late = plant({ nextWaterAt: at(9, 20), lastWateredAt: at(9, 13, 12) });
    const plan = water(late, 'ok');

    expect(plan.plantPatch).toMatchObject({
      learnFactor: 1.0,
      lastWateredAt: at(9, 27, 12),
      nextWaterAt: at(10, 4),
    });
  });

  it('미뤘던 횟수와 "마지막 물 준 날 모름" 표시는 물을 주면 풀린다', () => {
    const plan = water(plant({ postponeCount: 2, lastWateredUnknown: true }), 'ok');

    expect(plan.plantPatch).toMatchObject({ postponeCount: 0, lastWateredUnknown: false });
  });

  it('공간의 빛과 계절이 다음 물주기에 반영된다: 겨울 약광 7 × 1.6 × 1.3 = 15일', () => {
    const dim = { ...livingRoom, lightGrade: 'low' as const };
    const plan = planWatering(
      plant({}),
      dim,
      { soilState: 'ok', leafDroop: false },
      { ...context, season: 'winter', logId: 'log-1' },
    );

    expect(plan.result.days).toBe(15);
  });

  it('수경은 흙 상태로 배우지 않고 7일 뒤 물을 간다', () => {
    const hydro = plant({ soilType: 'hydro', learnFactor: 1.3 });
    const plan = water(hydro, 'wet');

    expect(plan.plantPatch).toMatchObject({ learnFactor: 1.3, nextWaterAt: at(10, 4) });
    expect(plan.log).toMatchObject({ soilState: 'skipped', factorSnapshot: null, intervalCalc: 7 });
  });

  it('주기를 수동으로 고정한 식물도 배우지 않는다 (흙 상태가 엔진이 아니라 고정 주기를 말해 주므로)', () => {
    const manual = plant({ manualInterval: 10, learnFactor: 1.1 });
    const plan = water(manual, 'dry');

    expect(plan.plantPatch).toMatchObject({ learnFactor: 1.1, nextWaterAt: at(10, 7) });
    expect(plan.log).toMatchObject({ soilState: 'dry', factorSnapshot: null });
  });

  it('입력으로 받은 식물을 바꾸지 않는다', () => {
    const frozen = Object.freeze(plant({}));

    expect(() => water(frozen, 'wet')).not.toThrow();
    expect(frozen.learnFactor).toBe(1.0);
  });
});

describe('planPostpone: "내일로" (SPEC.md 5.5)', () => {
  it('다음 물주기를 내일로 옮기고 미룬 횟수를 센다', () => {
    expect(planPostpone(plant({}), context)).toEqual({ nextWaterAt: at(9, 28), postponeCount: 1 });
  });

  it('세 번까지 미룰 수 있고, 네 번째는 미뤄지지 않아 다음 날 밀림이 된다', () => {
    expect(planPostpone(plant({ postponeCount: 2 }), context)).toEqual({
      nextWaterAt: at(9, 28),
      postponeCount: 3,
    });
    expect(planPostpone(plant({ postponeCount: 3 }), context)).toBeNull();
  });

  it('미룬 날은 엔진의 다음 물주기 계산(마지막 물 준 날 + 주기 + 미룬 횟수)과 맞는다', () => {
    const patch = planPostpone(plant({}), context);

    // 9월 20일 + 7일 + 1회 = 9월 28일
    expect(patch?.nextWaterAt).toBe(at(9, 28));
  });
});

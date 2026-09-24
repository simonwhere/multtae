import { describe, expect, it } from 'vitest';

import type { Plant, WateringLog } from '../db/schema';
import { DEFAULT_COEFFICIENTS } from '../engine';
import type { EngineSpace } from '../engine';
import { plantStats, RECENT_GAPS } from './stats';

const KST = 540;
const at = (month: number, day: number, hour = 12) => Date.UTC(2026, month - 1, day, hour - 9);
const window: EngineSpace = { lightGrade: 'medium', spaceType: 'indoor_window' };
const context = {
  now: at(9, 30, 10),
  utcOffsetMinutes: KST,
  season: 'autumn' as const,
  coefficients: DEFAULT_COEFFICIENTS,
};

function plant(patch: Partial<Plant> = {}): Plant {
  return {
    id: 'plant-1',
    spaceId: 'space-1',
    scientificName: null,
    nickname: '몬스테라',
    groupCode: 'tropical',
    potSize: 'm',
    soilType: 'potting',
    isBonsai: false,
    bonsaiGroup: null,
    learnFactor: 1,
    baseInterval: 7,
    manualInterval: null,
    manualSeason: null,
    lastWateredAt: at(9, 27),
    lastWateredUnknown: false,
    nextWaterAt: at(10, 4, 0),
    lastRepotAt: null,
    postponeCount: 0,
    coverPhotoPath: null,
    createdAt: 1,
    updatedAt: 1,
    ...patch,
  };
}

let seq = 0;
function log(wateredAt: number, dueAt: number | null = null, source: WateringLog['source'] = 'user'): WateringLog {
  seq += 1;
  return {
    id: `log-${seq}`,
    plantId: 'plant-1',
    wateredAt,
    soilState: 'ok',
    leafDroop: false,
    source,
    intervalCalc: 7,
    factorSnapshot: null,
    dueAt,
  };
}

describe('plantStats: 식물별 통계 (SPEC.md 3.5)', () => {
  it('실제로 물을 준 평균 간격과 지금 알림 간격', () => {
    const logs = [log(at(9, 6)), log(at(9, 13)), log(at(9, 21)), log(at(9, 27))];

    expect(plantStats(plant(), window, logs, context)).toMatchObject({
      // 7, 8, 6 일 → 평균 7
      averageDays: 7,
      currentDays: 7,
      waterings: 4,
    });
  });

  it('물 준 날이 하루뿐이면 평균이 없다. 같은 날 두 번은 한 번으로 본다', () => {
    expect(plantStats(plant(), window, [], context).averageDays).toBeNull();
    expect(plantStats(plant(), window, [log(at(9, 27, 9)), log(at(9, 27, 18))], context).averageDays).toBeNull();
  });

  it('평균은 최근 간격 10개로 낸다', () => {
    // 오래전 30일 간격 한 번과 최근 3일 간격 10번
    const logs = [log(at(5, 1)), log(at(5, 31))];
    for (let day = 3; day <= 30; day += 3) logs.push(log(at(6, day)));

    expect(RECENT_GAPS).toBe(10);
    expect(plantStats(plant(), window, logs, context).averageDays).toBe(3);
  });

  it('예정일을 넘겨 준 물만 밀림으로 센다. 30일 전의 것과 기록이 없는 옛 기록은 세지 않는다', () => {
    const logs = [
      log(at(8, 20), at(8, 18, 0)), // 30일 밖
      log(at(9, 10), at(9, 10, 0)), // 제날짜
      log(at(9, 18), at(9, 16, 0)), // 이틀 밀림
      log(at(9, 24), at(9, 23, 0)), // 하루 밀림
      log(at(9, 27), null), // 0004 전 기록
    ];

    expect(plantStats(plant(), window, logs, context).overdueCount).toBe(2);
  });

  it('비가 대신 준 날도 물 준 날로 센다', () => {
    const logs = [log(at(9, 20)), log(at(9, 27), null, 'rain')];

    expect(plantStats(plant(), window, logs, context)).toMatchObject({ averageDays: 7, waterings: 2 });
  });

  it('지금 밀려 있으면 한 번 더 센다', () => {
    const late = plant({ nextWaterAt: at(9, 28, 0) });

    expect(plantStats(late, window, [], context).overdueCount).toBe(1);
    expect(plantStats(plant(), window, [], context).overdueCount).toBe(0);
  });
});

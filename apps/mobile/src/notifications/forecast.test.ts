import { describe, expect, it } from 'vitest';

import type { PlantWithSpace } from '../db/plants';
import type { Plant, Space } from '../db/schema';
import { DEFAULT_COEFFICIENTS } from '../engine';
import type { CalendarDate } from '../engine';
import { forecast } from './forecast';

const C = DEFAULT_COEFFICIENTS;
const KST = 540;
const date = (month: number, day: number): CalendarDate => ({ year: 2026, month, day });
const at = (month: number, day: number, hour = 0) => Date.UTC(2026, month - 1, day, hour - 9);

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

function item(patch: Partial<Plant>): PlantWithSpace {
  return {
    space: livingRoom,
    plant: {
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
    },
  };
}

const context = (now: number) => ({ now, utcOffsetMinutes: KST, coefficients: C });

describe('forecast: 알림을 짜기 전에 식물별 물주기 날짜와 계절 전환을 내다본다', () => {
  it('14일 안에 계절이 바뀌지 않으면 저장된 날짜 그대로다', () => {
    const result = forecast(
      [item({ lastWateredAt: at(9, 20, 12), nextWaterAt: at(9, 27) })],
      context(at(9, 25, 7)),
    );

    expect(result).toEqual({
      plants: [{ nickname: '몬스테라', waterDate: date(9, 27), hydro: false }],
      seasonChanges: [],
    });
  });

  it('전환일 뒤에 예정된 식물은 새 계절 주기로 미리 센다. 앱을 열지 않아도 알림이 맞게 온다', () => {
    const result = forecast(
      [
        item({}),
        item({ id: 'early', nickname: '벤자민', lastWateredAt: at(11, 7, 12), nextWaterAt: at(11, 14) }),
      ],
      context(at(11, 10, 7)),
    );

    expect(result.plants).toEqual([
      // 겨울 11일: 11월 10일 + 11일
      { nickname: '몬스테라', waterDate: date(11, 21), hydro: false },
      // 전환 전에 예정된 식물은 그대로
      { nickname: '벤자민', waterDate: date(11, 14), hydro: false },
    ]);
    expect(result.seasonChanges).toEqual([{ season: 'winter', date: date(11, 16), trend: 'longer' }]);
  });

  it('전환 당일도 알린다. 앱을 8시 전에 열어도 그날 알림이 빠지지 않는다', () => {
    const result = forecast([item({ nextWaterAt: at(11, 21) })], context(at(11, 16, 7)));

    expect(result.seasonChanges).toEqual([{ season: 'winter', date: date(11, 16), trend: 'longer' }]);
    expect(result.plants[0].waterDate).toEqual(date(11, 21));
  });

  it('14일째 전환까지 본다', () => {
    const edge = forecast([item({})], context(at(11, 3, 7)));
    const outside = forecast([item({})], context(at(11, 2, 7)));

    expect(edge.seasonChanges.map((change) => change.date)).toEqual([date(11, 16)]);
    expect(outside.seasonChanges).toEqual([]);
  });

  it('주기 변화는 내 식물 전체의 합으로 본다', () => {
    const monstera = item({ lastWateredAt: at(7, 23, 12), nextWaterAt: at(8, 1) });
    const hydro = item({ id: 'hydro', soilType: 'hydro', lastWateredAt: at(7, 23, 12), nextWaterAt: at(7, 30) });

    // 장마 → 폭염: 열대 관엽 9일 → 5일
    expect(forecast([monstera], context(at(7, 20, 7))).seasonChanges[0]).toMatchObject({
      season: 'heat',
      trend: 'shorter',
    });
    // 수경은 계절과 무관하다
    expect(forecast([hydro], context(at(7, 20, 7))).seasonChanges[0].trend).toBe('same');
  });

  it('수경 식물을 가려 준다', () => {
    const result = forecast(
      [item({ soilType: 'hydro', lastWateredAt: at(9, 20, 12), nextWaterAt: at(9, 27) })],
      context(at(9, 25, 7)),
    );

    expect(result.plants[0]).toMatchObject({ hydro: true });
  });

  it('식물이 없으면 계절 전환도 알리지 않는다', () => {
    expect(forecast([], context(at(11, 10, 7)))).toEqual({ plants: [], seasonChanges: [] });
  });
});

import { beforeEach, describe, expect, it } from 'vitest';

import { insertEvent } from '../db/events';
import { getPlantWithSpace, insertPlant, listPlantsWithSpace } from '../db/plants';
import type { NewPlant } from '../db/schema';
import { insertSpace } from '../db/spaces';
import { createTestDb } from '../db/testing/test-db';
import type { TestDb } from '../db/testing/test-db';
import { recordWatering } from '../db/watering';
import { isFertilizerDueToday, repotHints } from './feeding-db';

const KST = 540;
const at = (year: number, month: number, day: number, hour = 12) => Date.UTC(year, month - 1, day, hour - 9);

const plant = (patch: Partial<NewPlant>): NewPlant => ({
  id: 'plant-1',
  spaceId: 'space-1',
  nickname: '몬스테라',
  groupCode: 'tropical',
  potSize: 'm',
  soilType: 'potting',
  lastWateredAt: at(2026, 9, 20),
  nextWaterAt: at(2026, 9, 27, 0),
  createdAt: at(2026, 6, 1),
  ...patch,
});

let db: TestDb;

beforeEach(async () => {
  ({ db } = createTestDb());
  await insertSpace(db, {
    id: 'space-1',
    name: '거실 창가',
    direction: 'S',
    spaceType: 'indoor_window',
    lightGrade: 'medium',
    lightSource: 'default',
    createdAt: 1,
  });
});

describe('isFertilizerDueToday (SPEC.md 8.2)', () => {
  const september = { now: at(2026, 9, 27, 8), utcOffsetMinutes: KST, season: 'autumn' as const };

  it('비료 기록이 없으면 등록일부터 센다', async () => {
    await insertPlant(db, plant({ createdAt: at(2026, 9, 10) }), []);
    const { plant: recent } = (await getPlantWithSpace(db, 'plant-1'))!;

    expect(await isFertilizerDueToday(db, recent, september)).toBe(false);
  });

  it('마지막 비료에서 4주가 지나면 준다', async () => {
    await insertPlant(db, plant({}), []);
    await insertEvent(db, { id: 'f1', plantId: 'plant-1', type: 'fertilize', occurredAt: at(2026, 8, 29) });
    const { plant: fed } = (await getPlantWithSpace(db, 'plant-1'))!;

    expect(await isFertilizerDueToday(db, fed, september)).toBe(true);
    expect(await isFertilizerDueToday(db, fed, { ...september, now: at(2026, 9, 25, 8) })).toBe(false);
  });
});

describe('repotHints (SPEC.md 8.3)', () => {
  it('흙이 다섯 번 중 네 번 바싹 말랐으면 뿌리 확인 카드', async () => {
    await insertPlant(db, plant({}), []);
    const states = ['dry', 'dry', 'ok', 'dry', 'dry'] as const;
    for (const [index, soilState] of states.entries()) {
      await recordWatering(db, 'plant-1', { lastWateredAt: at(2026, 9, 1 + index * 5) }, {
        id: `w${index}`,
        plantId: 'plant-1',
        wateredAt: at(2026, 9, 1 + index * 5),
        soilState,
        leafDroop: false,
        source: 'user',
      });
    }

    const hints = await repotHints(db, await listPlantsWithSpace(db), {
      now: at(2026, 9, 27, 8),
      utcOffsetMinutes: KST,
    });

    expect(hints.map(({ plant: p, hint }) => [p.nickname, hint.reason])).toEqual([['몬스테라', 'roots']]);
  });

  it('권장 주기가 지났고 적기면 분갈이 카드. 분재는 빼고 본다', async () => {
    await insertPlant(db, plant({ createdAt: at(2024, 1, 1) }), []);
    await insertPlant(db, plant({ id: 'plant-2', nickname: '곰솔', isBonsai: true, createdAt: at(2020, 1, 1) }), []);

    const hints = await repotHints(db, await listPlantsWithSpace(db), {
      now: at(2026, 3, 5, 8),
      utcOffsetMinutes: KST,
    });

    expect(hints).toEqual([
      expect.objectContaining({
        plant: expect.objectContaining({ nickname: '몬스테라' }),
        hint: { reason: 'interval', months: 26, known: false, season: [3, 4] },
      }),
    ]);
  });
});

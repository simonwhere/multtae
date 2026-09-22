import { beforeEach, describe, expect, it } from 'vitest';

import { insertEvent } from './events';
import { deletePlant, getPlantWithSpace, insertPlant, updatePlant } from './plants';
import type { NewPlant, NewSpace } from './schema';
import { insertSpace } from './spaces';
import { createTestDb } from './testing/test-db';
import type { TestDb } from './testing/test-db';
import { listPlantWaterings, listRecentWaterings, recordWatering } from './watering';

const livingRoom: NewSpace = {
  id: 'space-1',
  name: '남향 거실 창가',
  direction: 'S',
  spaceType: 'indoor_window',
  lightGrade: 'medium',
  lightSource: 'default',
  createdAt: 1_000,
};

const monstera: NewPlant = {
  id: 'plant-1',
  spaceId: 'space-1',
  nickname: '몬스테라',
  groupCode: 'tropical',
  potSize: 'm',
  soilType: 'potting',
  lastWateredAt: 5_000,
  lastWateredUnknown: true,
  nextWaterAt: 9_000,
  postponeCount: 2,
  createdAt: 5_000,
};

let db: TestDb;

beforeEach(async () => {
  ({ db } = createTestDb());
  await insertSpace(db, livingRoom);
  await insertPlant(db, monstera, []);
});

describe('식물 한 개 읽기와 고치기', () => {
  it('공간과 함께 읽는다. 없으면 null', async () => {
    expect((await getPlantWithSpace(db, 'plant-1'))?.space.name).toBe('남향 거실 창가');
    expect(await getPlantWithSpace(db, 'ghost')).toBeNull();
  });

  it('"내일로": 넘겨준 값만 바뀐다', async () => {
    await updatePlant(db, 'plant-1', { nextWaterAt: 12_000, postponeCount: 3 });

    expect((await getPlantWithSpace(db, 'plant-1'))?.plant).toMatchObject({
      nextWaterAt: 12_000,
      postponeCount: 3,
      nickname: '몬스테라',
      lastWateredAt: 5_000,
    });
  });
});

describe('recordWatering: 물 줬어요', () => {
  const patch = {
    learnFactor: 1.15,
    lastWateredAt: 20_000,
    lastWateredUnknown: false,
    nextWaterAt: 28_000,
    postponeCount: 0,
  };
  const log = {
    id: 'log-1',
    plantId: 'plant-1',
    wateredAt: 20_500,
    soilState: 'wet' as const,
    leafDroop: false,
    source: 'user' as const,
    intervalCalc: 8.05,
    factorSnapshot: { base: 7, season: 1, pot: 1, light: 1, spaceType: 1, soil: 1, learn: 1.15 },
  };

  it('식물을 갱신하고 기록을 남긴다', async () => {
    await recordWatering(db, 'plant-1', patch, log);

    expect((await getPlantWithSpace(db, 'plant-1'))?.plant).toMatchObject(patch);
    expect(await listRecentWaterings(db, 10)).toEqual([
      { log: expect.objectContaining(log), nickname: '몬스테라' },
    ]);
  });

  it('같은 기록을 두 번 저장해도 하나만 남는다', async () => {
    await recordWatering(db, 'plant-1', patch, log);
    await recordWatering(db, 'plant-1', patch, log);

    expect(await listRecentWaterings(db, 10)).toHaveLength(1);
  });

  it('최근 기록부터, 개수만큼 돌려준다', async () => {
    for (const [index, wateredAt] of [30_000, 10_000, 20_000].entries()) {
      await recordWatering(db, 'plant-1', patch, { ...log, id: `log-${index}`, wateredAt });
    }

    const recent = await listRecentWaterings(db, 2);

    expect(recent.map((entry) => entry.log.wateredAt)).toEqual([30_000, 20_000]);
  });

  it('식물 하나의 기록만, 최근 것부터 돌려준다 (3.4 이력)', async () => {
    await insertPlant(db, { ...monstera, id: 'plant-2', nickname: '곰솔' }, []);
    await recordWatering(db, 'plant-1', patch, { ...log, id: 'a', wateredAt: 10_000 });
    await recordWatering(db, 'plant-2', patch, { ...log, id: 'b', plantId: 'plant-2', wateredAt: 20_000 });
    await recordWatering(db, 'plant-1', patch, { ...log, id: 'c', wateredAt: 30_000 });

    const waterings = await listPlantWaterings(db, 'plant-1', 5);

    expect(waterings.map((entry) => entry.id)).toEqual(['c', 'a']);
    expect(await listPlantWaterings(db, 'plant-1', 1)).toHaveLength(1);
  });
});

describe('deletePlant: 식물 삭제 (3.4 편집)', () => {
  it('식물과 딸린 기록·사진 행을 지우고, 지워야 할 사진 파일 경로를 돌려준다', async () => {
    await insertPlant(db, { ...monstera, id: 'plant-2', nickname: '곰솔', coverPhotoPath: 'plants/cover.jpg' }, [
      { id: 'photo-1', plantId: 'plant-2', path: 'plants/cover.jpg', takenAt: 1 },
      { id: 'photo-2', plantId: 'plant-2', path: 'plants/leaf.jpg', takenAt: 2 },
    ]);
    await recordWatering(
      db,
      'plant-2',
      { lastWateredAt: 20_000 },
      {
        id: 'log-9',
        plantId: 'plant-2',
        wateredAt: 20_000,
        soilState: 'ok',
        source: 'user',
      },
    );

    // 진단 사진은 이벤트에 붙어 있다 (8.1)
    await insertEvent(db, {
      id: 'event-1',
      plantId: 'plant-2',
      type: 'diagnose',
      occurredAt: 21_000,
      photoPath: 'plants/diagnose.jpg',
    });

    const paths = await deletePlant(db, 'plant-2');

    expect(paths.sort()).toEqual(['plants/cover.jpg', 'plants/diagnose.jpg', 'plants/leaf.jpg']);
    expect(await getPlantWithSpace(db, 'plant-2')).toBeNull();
    expect(await listPlantWaterings(db, 'plant-2', 5)).toEqual([]);
    // 다른 식물은 그대로다
    expect(await getPlantWithSpace(db, 'plant-1')).not.toBeNull();
  });

  it('없는 식물이면 아무것도 하지 않는다', async () => {
    expect(await deletePlant(db, 'ghost')).toEqual([]);
  });
});

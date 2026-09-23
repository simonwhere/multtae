import { beforeEach, describe, expect, it } from 'vitest';

import { addPlantPhoto, listPlantPhotos } from './photos';
import { insertPlant } from './plants';
import type { NewPlant, NewSpace } from './schema';
import { insertSpace } from './spaces';
import { createTestDb } from './testing/test-db';
import type { TestDb } from './testing/test-db';

const space: NewSpace = {
  id: 'space-1',
  name: '거실 창가',
  direction: 'S',
  spaceType: 'indoor_window',
  lightGrade: 'medium',
  lightSource: 'default',
  createdAt: 1,
};

const plant: NewPlant = {
  id: 'plant-1',
  spaceId: 'space-1',
  nickname: '몬스테라',
  groupCode: 'tropical',
  potSize: 'm',
  soilType: 'potting',
  lastWateredAt: 1_000,
  nextWaterAt: 2_000,
  createdAt: 1_000,
};

let db: TestDb;

beforeEach(async () => {
  ({ db } = createTestDb());
  await insertSpace(db, space);
  await insertPlant(db, plant, []);
});

describe('식물 사진 (SPEC.md 8.4)', () => {
  it('최근에 찍은 것부터 돌려준다', async () => {
    await addPlantPhoto(db, { id: 'p1', plantId: 'plant-1', path: 'plants/1.jpg', takenAt: 1_000 });
    await addPlantPhoto(db, { id: 'p2', plantId: 'plant-1', path: 'plants/2.jpg', takenAt: 3_000 });
    await addPlantPhoto(db, { id: 'p3', plantId: 'plant-1', path: 'plants/3.jpg', takenAt: 2_000 });

    expect((await listPlantPhotos(db, 'plant-1')).map((photo) => photo.id)).toEqual(['p2', 'p3', 'p1']);
  });

  it('정해 둔 수를 넘으면 오래된 것부터 지우고 그 경로를 돌려준다', async () => {
    for (const index of [1, 2, 3]) {
      await addPlantPhoto(
        db,
        { id: `p${index}`, plantId: 'plant-1', path: `plants/${index}.jpg`, takenAt: index * 1_000 },
        3,
      );
    }

    const pruned = await addPlantPhoto(
      db,
      { id: 'p4', plantId: 'plant-1', path: 'plants/4.jpg', takenAt: 4_000 },
      3,
    );

    expect(pruned).toEqual(['plants/1.jpg']);
    expect((await listPlantPhotos(db, 'plant-1')).map((photo) => photo.id)).toEqual(['p4', 'p3', 'p2']);
  });

  it('같은 id 를 두 번 넣어도 늘지 않는다', async () => {
    const photo = { id: 'p1', plantId: 'plant-1', path: 'plants/1.jpg', takenAt: 1_000 };
    await addPlantPhoto(db, photo);
    await addPlantPhoto(db, photo);

    expect(await listPlantPhotos(db, 'plant-1')).toHaveLength(1);
  });
});

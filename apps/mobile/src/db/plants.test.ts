import { beforeEach, describe, expect, it } from 'vitest';

import { clearPlantDraft, loadPlantDraft, savePlantDraft } from '../plants/draft-store';
import { createPlantDraft, reducePlantDraft } from '../plants/registration';
import { countPlants, insertPlant, listPlantsWithSpace } from './plants';
import { photos } from './schema';
import type { NewPhoto, NewPlant, NewSpace } from './schema';
import { setSetting } from './settings';
import { insertSpace } from './spaces';
import { createTestDb } from './testing/test-db';
import type { TestDb } from './testing/test-db';

const livingRoom: NewSpace = {
  id: 'space-1',
  name: '남향 실내 창가',
  direction: 'S',
  spaceType: 'indoor_window',
  lightGrade: 'high',
  lightSource: 'default',
  createdAt: 1_000,
};

const monstera: NewPlant = {
  id: 'plant-1',
  spaceId: 'space-1',
  scientificName: 'Monstera deliciosa',
  nickname: '몬스테라',
  groupCode: 'tropical',
  potSize: 'm',
  soilType: 'potting',
  lastWateredAt: 5_000,
  nextWaterAt: 9_000,
  coverPhotoPath: 'plants/plant-1-a.jpg',
  createdAt: 5_000,
};

const monsteraPhotos: NewPhoto[] = [
  { id: 'plant-1-photo-1', plantId: 'plant-1', path: 'plants/plant-1-a.jpg', takenAt: 5_000 },
  { id: 'plant-1-photo-2', plantId: 'plant-1', path: 'plants/plant-1-b.jpg', takenAt: 5_000 },
];

let db: TestDb;

beforeEach(async () => {
  ({ db } = createTestDb());
  await insertSpace(db, livingRoom);
});

describe('식물 저장소', () => {
  it('처음에는 식물이 없다', async () => {
    expect(await listPlantsWithSpace(db)).toEqual([]);
    expect(await countPlants(db)).toBe(0);
  });

  it('식물과 사진을 함께 저장하고, 놓인 공간과 같이 돌려준다', async () => {
    await insertPlant(db, monstera, monsteraPhotos);

    const [item] = await listPlantsWithSpace(db);

    expect(item.plant).toMatchObject({ ...monstera, learnFactor: 1, lastWateredUnknown: false });
    expect(item.space).toMatchObject({ id: 'space-1', name: '남향 실내 창가' });
    expect(await db.select().from(photos)).toHaveLength(2);
    expect(await countPlants(db)).toBe(1);
  });

  it('물 줄 날이 가까운 순서로 돌려준다', async () => {
    await insertPlant(db, { ...monstera, id: 'plant-late', nickname: '나중', nextWaterAt: 30_000 }, []);
    await insertPlant(db, { ...monstera, id: 'plant-soon', nickname: '먼저', nextWaterAt: 7_000 }, []);
    await insertPlant(db, monstera, []);

    const nicknames = (await listPlantsWithSpace(db)).map((item) => item.plant.nickname);

    expect(nicknames).toEqual(['먼저', '몬스테라', '나중']);
  });

  it('같은 id 로 다시 저장해도 식물과 사진이 늘지 않는다 (저장 도중 앱이 꺼진 뒤의 재시도)', async () => {
    await insertPlant(db, monstera, monsteraPhotos);
    await insertPlant(db, { ...monstera, nickname: '다시 저장' }, monsteraPhotos);

    expect(await countPlants(db)).toBe(1);
    expect((await listPlantsWithSpace(db))[0].plant.nickname).toBe('몬스테라');
    expect(await db.select().from(photos)).toHaveLength(2);
  });
});

describe('식물 등록 임시 저장 (SPEC 4)', () => {
  const draft = [
    { type: 'photoAdded', photo: { path: 'plants/p.jpg', width: 960, height: 1280 } } as const,
    { type: 'next' } as const,
    { type: 'speciesChosen', scientificName: 'Pinus thunbergii' } as const,
  ].reduce(reducePlantDraft, createPlantDraft('plant-9'));

  it('저장한 적이 없으면 null 이다', async () => {
    expect(await loadPlantDraft(db)).toBeNull();
  });

  it('저장하고 되살리고 지운다', async () => {
    await savePlantDraft(db, draft);
    expect(await loadPlantDraft(db)).toEqual(draft);

    await clearPlantDraft(db);
    expect(await loadPlantDraft(db)).toBeNull();
  });

  it('깨진 값이 들어 있으면 없는 것으로 본다', async () => {
    await setSetting(db, 'draft_plant', '{broken');

    expect(await loadPlantDraft(db)).toBeNull();
  });
});

import { asc, count, eq } from 'drizzle-orm';

import { photos, plants, spaces } from './schema';
import type { NewPhoto, NewPlant, Plant, Space } from './schema';
import type { Database } from './types';

export interface PlantWithSpace {
  plant: Plant;
  space: Space;
}

/** 놓인 공간과 함께, 물 줄 날이 가까운 순서로 */
export async function listPlantsWithSpace(db: Database): Promise<PlantWithSpace[]> {
  return db
    .select({ plant: plants, space: spaces })
    .from(plants)
    .innerJoin(spaces, eq(plants.spaceId, spaces.id))
    .orderBy(asc(plants.nextWaterAt), asc(plants.createdAt), asc(plants.id));
}

export async function countPlants(db: Database): Promise<number> {
  const rows = await db.select({ total: count() }).from(plants);
  return rows[0].total;
}

/**
 * 식물과 등록 때 찍은 사진을 저장한다. 같은 id 가 이미 있으면 그대로 둔다.
 * 저장 직후 앱이 꺼져 초안이 남았다가 다시 저장해도 식물이나 사진이 둘이 되지 않는다.
 */
export async function insertPlant(
  db: Database,
  plant: NewPlant,
  plantPhotos: NewPhoto[],
): Promise<void> {
  await db.insert(plants).values(plant).onConflictDoNothing({ target: plants.id });
  if (plantPhotos.length > 0) {
    await db.insert(photos).values(plantPhotos).onConflictDoNothing({ target: photos.id });
  }
}

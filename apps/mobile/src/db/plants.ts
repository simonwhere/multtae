import { asc, count, eq } from 'drizzle-orm';

import { events, photos, plants, spaces } from './schema';
import type { NewPhoto, NewPlant, Plant, Space } from './schema';
import type { Database, UpdateOptions } from './types';

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

export async function getPlantWithSpace(
  db: Database,
  plantId: string,
): Promise<PlantWithSpace | null> {
  const rows = await db
    .select({ plant: plants, space: spaces })
    .from(plants)
    .innerJoin(spaces, eq(plants.spaceId, spaces.id))
    .where(eq(plants.id, plantId));
  return rows[0] ?? null;
}

/** 식물에서 고칠 수 있는 값. id 와 등록 시각은 바꾸지 않는다 */
export type PlantPatch = Partial<Omit<Plant, 'id' | 'createdAt'>>;

export async function updatePlant(
  db: Database,
  plantId: string,
  patch: PlantPatch,
  { touch = true, now = Date.now() }: UpdateOptions = {},
): Promise<void> {
  await db
    .update(plants)
    .set(touch ? { ...patch, updatedAt: now } : patch)
    .where(eq(plants.id, plantId));
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
  await db
    .insert(plants)
    .values({ ...plant, updatedAt: plant.updatedAt ?? plant.createdAt })
    .onConflictDoNothing({ target: plants.id });
  if (plantPhotos.length > 0) {
    await db.insert(photos).values(plantPhotos).onConflictDoNothing({ target: photos.id });
  }
}

/**
 * 식물을 지운다. 물주기 기록·이벤트·사진 행은 외래 키가 함께 지운다. 이벤트에 붙은 사진(진단)도 돌려준다.
 * 사진 파일은 DB 밖에 있으므로 지워야 할 경로를 돌려주고, 파일은 호출한 쪽이 지운다.
 */
export async function deletePlant(db: Database, plantId: string): Promise<string[]> {
  const target = await db
    .select({ coverPhotoPath: plants.coverPhotoPath })
    .from(plants)
    .where(eq(plants.id, plantId));
  if (target.length === 0) return [];

  const rows = await db.select({ path: photos.path }).from(photos).where(eq(photos.plantId, plantId));
  // 진단 사진처럼 이벤트에 붙은 사진도 함께 지운다
  const eventRows = await db
    .select({ path: events.photoPath })
    .from(events)
    .where(eq(events.plantId, plantId));
  const paths = new Set(rows.map((row) => row.path));
  for (const { path } of eventRows) if (path) paths.add(path);
  if (target[0].coverPhotoPath) paths.add(target[0].coverPhotoPath);

  await db.delete(plants).where(eq(plants.id, plantId));
  return [...paths];
}

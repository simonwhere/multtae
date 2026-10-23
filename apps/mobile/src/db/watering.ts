import { desc, eq } from 'drizzle-orm';

import { updatePlant } from './plants';
import type { PlantPatch } from './plants';
import { plants, wateringLogs } from './schema';
import type { NewWateringLog, WateringLog } from './schema';
import type { Database, UpdateOptions } from './types';

/**
 * "물 줬어요": 기록을 남기고 식물을 갱신한다. 기록을 먼저 넣고, 같은 id 는 무시한다.
 * 도중에 앱이 꺼져 다시 저장해도 기록이 둘이 되지 않는다.
 */
export async function recordWatering(
  db: Database,
  plantId: string,
  patch: PlantPatch,
  log: NewWateringLog,
  options?: UpdateOptions,
): Promise<void> {
  await db.insert(wateringLogs).values(log).onConflictDoNothing({ target: wateringLogs.id });
  await updatePlant(db, plantId, patch, options);
}

/** 시트에서 흙 상태를 덧붙일 때. 기록이 먼저 있고 식물은 그 뒤에 고친다 (10-2) */
export async function updateWateringLog(
  db: Database,
  logId: string,
  patch: Partial<Pick<WateringLog, 'soilState' | 'leafDroop' | 'intervalCalc' | 'factorSnapshot'>>,
): Promise<void> {
  await db.update(wateringLogs).set(patch).where(eq(wateringLogs.id, logId));
}

/** "안 줬어요": 방금 남긴 기록을 지우고 식물을 기록 전으로 되돌린다 */
export async function undoWatering(
  db: Database,
  logId: string,
  plantId: string,
  before: PlantPatch,
): Promise<void> {
  await db.delete(wateringLogs).where(eq(wateringLogs.id, logId));
  await updatePlant(db, plantId, before, { touch: false });
}

export interface WateringWithPlant {
  log: WateringLog;
  nickname: string;
}

/** 최근 물주기 기록부터 */
export async function listRecentWaterings(
  db: Database,
  limit: number,
): Promise<WateringWithPlant[]> {
  return db
    .select({ log: wateringLogs, nickname: plants.nickname })
    .from(wateringLogs)
    .innerJoin(plants, eq(wateringLogs.plantId, plants.id))
    .orderBy(desc(wateringLogs.wateredAt), desc(wateringLogs.id))
    .limit(limit);
}

/** 식물 하나의 물주기 기록. 최근 것부터 */
export async function listPlantWaterings(
  db: Database,
  plantId: string,
  limit: number,
): Promise<WateringLog[]> {
  return db
    .select()
    .from(wateringLogs)
    .where(eq(wateringLogs.plantId, plantId))
    .orderBy(desc(wateringLogs.wateredAt), desc(wateringLogs.id))
    .limit(limit);
}

import { desc, eq } from 'drizzle-orm';

import { updatePlant } from './plants';
import type { PlantPatch } from './plants';
import { plants, wateringLogs } from './schema';
import type { NewWateringLog, WateringLog } from './schema';
import type { Database } from './types';

/**
 * "물 줬어요": 기록을 남기고 식물을 갱신한다. 기록을 먼저 넣고, 같은 id 는 무시한다.
 * 도중에 앱이 꺼져 다시 저장해도 기록이 둘이 되지 않는다.
 */
export async function recordWatering(
  db: Database,
  plantId: string,
  patch: PlantPatch,
  log: NewWateringLog,
): Promise<void> {
  await db.insert(wateringLogs).values(log).onConflictDoNothing({ target: wateringLogs.id });
  await updatePlant(db, plantId, patch);
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

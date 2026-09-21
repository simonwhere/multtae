/**
 * 분재 작업 (SPEC.md 6.2). 등록할 때 종 DB 의 작업을 복사해 두고, 완료는 해마다 다시 돌아온다.
 */
import { asc, eq } from 'drizzle-orm';

import { plantTasks } from './schema';
import type { NewPlantTask, PlantTask } from './schema';
import type { Database } from './types';

export async function listPlantTasks(db: Database, plantId: string): Promise<PlantTask[]> {
  return db
    .select()
    .from(plantTasks)
    .where(eq(plantTasks.plantId, plantId))
    .orderBy(asc(plantTasks.monthStart), asc(plantTasks.id));
}

/** 등록할 때 한 번. 같은 id 가 이미 있으면 그대로 둔다 */
export async function insertPlantTasks(db: Database, tasks: NewPlantTask[]): Promise<void> {
  if (tasks.length === 0) return;
  await db.insert(plantTasks).values(tasks).onConflictDoNothing({ target: plantTasks.id });
}

/** 올해 마친 것으로 표시한다. 내년이 되면 다시 할 일로 돌아온다 */
export async function markTaskDone(db: Database, taskId: string, year: number | null): Promise<void> {
  await db.update(plantTasks).set({ doneYear: year }).where(eq(plantTasks.id, taskId));
}

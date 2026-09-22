/**
 * 분재 작업 (SPEC.md 6.2). 등록할 때 종 DB 의 작업을 복사해 두고, 완료는 해마다 다시 돌아온다.
 */
import { asc, eq } from 'drizzle-orm';

import { events, plantTasks } from './schema';
import type { NewPlantTask, PlantTask } from './schema';
import type { Database } from './types';

/** 작업 완료 기록의 id. 한 해에 한 번만 남고, 되돌리면 이 id 로 지운다 */
export function taskEventId(taskId: string, year: number): string {
  return `task-${taskId}-${year}`;
}

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

/**
 * 올해 마친 것으로 표시하고 기록 탭에 남긴다 (SPEC 8.4 작업 이벤트). year 가 null 이면 되돌리고 기록도 지운다.
 * 내년이 되면 다시 할 일로 돌아온다.
 */
export async function markTaskDone(
  db: Database,
  task: Pick<PlantTask, 'id' | 'plantId' | 'taskCode' | 'labelKo' | 'doneYear'>,
  year: number | null,
  now: number,
): Promise<void> {
  await db.update(plantTasks).set({ doneYear: year }).where(eq(plantTasks.id, task.id));

  if (year !== null) {
    await db
      .insert(events)
      .values({
        id: taskEventId(task.id, year),
        plantId: task.plantId,
        type: 'task',
        occurredAt: now,
        payload: { taskCode: task.taskCode, labelKo: task.labelKo },
      })
      .onConflictDoNothing({ target: events.id });
  } else if (task.doneYear !== null) {
    await db.delete(events).where(eq(events.id, taskEventId(task.id, task.doneYear)));
  }
}

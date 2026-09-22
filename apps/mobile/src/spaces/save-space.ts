/**
 * 공간을 고쳐 저장한다 (SPEC.md 3.3). 빛이 바뀌면 그 공간 식물의 다음 물주기를 다시 센다 (5장 L).
 * 알림 다시 예약과 화면 갱신은 부른 쪽이 한다. 여기서는 DB 만 만진다.
 */
import { listPlantsWithSpace, updatePlant } from '../db/plants';
import type { Space } from '../db/schema';
import { updateSpace } from '../db/spaces';
import type { SpacePatch } from '../db/spaces';
import type { Database } from '../db/types';
import { planSpaceReschedule } from '../plants/schedule';
import type { ScheduleContext } from '../plants/schedule';

/** 다시 센 식물 수를 돌려준다. 0 이면 알림을 다시 짤 필요가 없다 */
export async function saveSpacePatch(
  db: Database,
  space: Space,
  patch: SpacePatch,
  context: ScheduleContext,
): Promise<number> {
  await updateSpace(db, space.id, patch);

  const next = { ...space, ...patch };
  if (next.lightGrade === space.lightGrade && next.spaceType === space.spaceType) return 0;

  const plants = (await listPlantsWithSpace(db))
    .filter((item) => item.space.id === space.id)
    .map((item) => item.plant);
  const changes = planSpaceReschedule(plants, next, context);
  for (const change of changes) {
    await updatePlant(db, change.id, { nextWaterAt: change.nextWaterAt });
  }
  return changes.length;
}

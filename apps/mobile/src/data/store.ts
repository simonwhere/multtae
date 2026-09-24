/**
 * 내보내기·가져오기의 DB 쪽 (SPEC.md 3.6 데이터). 기기 안의 모든 기록을 읽고 쓰고 지운다.
 * 파일과 압축은 archive.ts 가 맡는다.
 */
import { events, photos, plants, plantTasks, settings, spaces, wateringLogs } from '../db/schema';
import type { Database } from '../db/types';
import type { Backup, BackupTables } from './backup';
import { planMerge } from './merge';
import type { MergeResult } from './merge';

/** 기기 안의 모든 표를 읽는다 */
export async function readAll(db: Database): Promise<BackupTables> {
  const [space, plant, logs, event, tasks, photo, setting] = await Promise.all([
    db.select().from(spaces),
    db.select().from(plants),
    db.select().from(wateringLogs),
    db.select().from(events),
    db.select().from(plantTasks),
    db.select().from(photos),
    db.select().from(settings),
  ]);

  return {
    spaces: space,
    plants: plant,
    wateringLogs: logs,
    events: event,
    plantTasks: tasks,
    photos: photo,
    settings: setting,
  };
}

/** 사진 파일까지 포함해 모두 지운다. 지워야 할 사진 경로를 돌려주고 파일은 호출한 쪽이 지운다 */
export async function deleteAll(db: Database): Promise<string[]> {
  const paths = await photoPaths(db);

  // 외래 키가 딸린 것부터 지운다
  await db.delete(wateringLogs);
  await db.delete(events);
  await db.delete(plantTasks);
  await db.delete(photos);
  await db.delete(plants);
  await db.delete(spaces);
  await db.delete(settings);
  return paths;
}

async function photoPaths(db: Database): Promise<string[]> {
  const [photoRows, plantRows, eventRows, spaceRows] = await Promise.all([
    db.select({ path: photos.path }).from(photos),
    db.select({ path: plants.coverPhotoPath }).from(plants),
    db.select({ path: events.photoPath }).from(events),
    db.select({ path: spaces.photoPath }).from(spaces),
  ]);
  const paths = new Set<string>();
  for (const { path } of [...photoRows, ...plantRows, ...eventRows, ...spaceRows]) {
    if (path) paths.add(path);
  }
  return [...paths];
}

/**
 * 가져온 것으로 바꾼다 (3.6). 지금 것을 모두 지우고 넣으므로 되돌릴 수 없다.
 * 지워야 할 옛 사진 경로를 돌려준다.
 */
export async function replaceAll(db: Database, backup: Backup): Promise<string[]> {
  const oldPaths = await deleteAll(db);

  // 9-2 이전 파일에는 고친 시각이 없다. 마이그레이션 0005 처럼 등록한 때로 채운다
  const edited = <T extends { createdAt: number; updatedAt?: number }>(row: T) => ({
    ...row,
    updatedAt: row.updatedAt ?? row.createdAt,
  });
  if (backup.spaces.length > 0) await db.insert(spaces).values(backup.spaces.map(edited));
  if (backup.plants.length > 0) await db.insert(plants).values(backup.plants.map(edited));
  if (backup.wateringLogs.length > 0) await db.insert(wateringLogs).values(backup.wateringLogs);
  if (backup.events.length > 0) await db.insert(events).values(backup.events);
  if (backup.plantTasks.length > 0) await db.insert(plantTasks).values(backup.plantTasks);
  if (backup.photos.length > 0) await db.insert(photos).values(backup.photos);
  if (backup.settings.length > 0) await db.insert(settings).values(backup.settings);

  // 가져온 사진은 파일도 함께 오므로 그 경로는 지우지 않는다
  const kept = new Set(backup.photos.map((photo) => photo.path));
  for (const space of backup.spaces) if (space.photoPath) kept.add(space.photoPath);
  for (const plant of backup.plants) if (plant.coverPhotoPath) kept.add(plant.coverPhotoPath);
  for (const event of backup.events) if (event.photoPath) kept.add(event.photoPath);
  return oldPaths.filter((path) => !kept.has(path));
}

/**
 * 가족과 나눈 파일을 합친다 (9-2). 지금 기록은 두고 새 것만 더하고, 같은 식물·공간은
 * merge.ts 의 규칙대로 맞춘다. 지워야 할 옛 사진 경로(사진 상한을 넘은 것 등)를 함께 돌려준다.
 */
export async function mergeAll(
  db: Database,
  incoming: Backup,
): Promise<{ result: MergeResult; removedPaths: string[] }> {
  const result = planMerge(await readAll(db), incoming);
  const removedPaths = await replaceAll(db, { ...incoming, ...result.tables });
  return { result, removedPaths };
}

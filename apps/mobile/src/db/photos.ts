/**
 * 식물 사진 (SPEC.md 8.4). 기기에만 두고 식물당 최근 100장만 남긴다.
 */
import { and, asc, desc, eq, inArray } from 'drizzle-orm';

import { photos } from './schema';
import type { NewPhoto, Photo } from './schema';
import type { Database } from './types';

/** 식물당 남기는 사진 수 (8.4) */
export const MAX_PHOTOS_PER_PLANT = 100;

/** 최근에 찍은 것부터 */
export async function listPlantPhotos(db: Database, plantId: string): Promise<Photo[]> {
  return db
    .select()
    .from(photos)
    .where(eq(photos.plantId, plantId))
    .orderBy(desc(photos.takenAt), desc(photos.id));
}

/**
 * 사진을 더하고 100장을 넘으면 오래된 것부터 지운다.
 * 파일은 DB 밖에 있으므로 지워야 할 경로를 돌려주고, 파일은 호출한 쪽이 지운다.
 */
export async function addPlantPhoto(
  db: Database,
  photo: NewPhoto,
  keep = MAX_PHOTOS_PER_PLANT,
): Promise<string[]> {
  await db.insert(photos).values(photo).onConflictDoNothing({ target: photos.id });

  const all = await db
    .select({ id: photos.id, path: photos.path })
    .from(photos)
    .where(eq(photos.plantId, photo.plantId))
    .orderBy(asc(photos.takenAt), asc(photos.id));
  const extra = all.slice(0, Math.max(0, all.length - keep));
  if (extra.length === 0) return [];

  await db.delete(photos).where(
    and(
      eq(photos.plantId, photo.plantId),
      inArray(
        photos.id,
        extra.map((row) => row.id),
      ),
    ),
  );
  return extra.map((row) => row.path);
}

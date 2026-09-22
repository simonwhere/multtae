import { asc, count, eq } from 'drizzle-orm';

import { plants, spaces } from './schema';
import type { NewSpace, Space } from './schema';
import type { Database } from './types';

/** 등록한 순서대로 */
export async function listSpaces(db: Database): Promise<Space[]> {
  return db.select().from(spaces).orderBy(asc(spaces.createdAt), asc(spaces.id));
}

export async function getSpace(db: Database, spaceId: string): Promise<Space | null> {
  const rows = await db.select().from(spaces).where(eq(spaces.id, spaceId));
  return rows[0] ?? null;
}

/** 공간에서 고칠 수 있는 값. id 와 등록 시각은 바꾸지 않는다 */
export type SpacePatch = Partial<Omit<Space, 'id' | 'createdAt'>>;

export async function updateSpace(
  db: Database,
  spaceId: string,
  patch: SpacePatch,
): Promise<void> {
  await db.update(spaces).set(patch).where(eq(spaces.id, spaceId));
}

/**
 * 공간을 지운다. 식물이 남아 있으면 지우지 않고 false 를 돌려준다.
 * 사진 파일은 DB 밖에 있으므로 지워야 할 경로를 함께 돌려주고, 파일은 호출한 쪽이 지운다.
 */
export async function deleteSpace(
  db: Database,
  spaceId: string,
): Promise<{ deleted: boolean; photoPath: string | null }> {
  const space = await getSpace(db, spaceId);
  if (!space) return { deleted: false, photoPath: null };

  const rows = await db.select({ total: count() }).from(plants).where(eq(plants.spaceId, spaceId));
  if (rows[0].total > 0) return { deleted: false, photoPath: null };

  await db.delete(spaces).where(eq(spaces.id, spaceId));
  return { deleted: true, photoPath: space.photoPath };
}

export async function countSpaces(db: Database): Promise<number> {
  const rows = await db.select({ total: count() }).from(spaces);
  return rows[0].total;
}

/**
 * 공간을 저장한다. 같은 id 가 이미 있으면 그대로 둔다.
 * 저장 직후 앱이 꺼져 초안이 남았다가 다시 저장해도 공간이 둘이 되지 않는다.
 */
export async function insertSpace(db: Database, space: NewSpace): Promise<void> {
  await db.insert(spaces).values(space).onConflictDoNothing({ target: spaces.id });
}

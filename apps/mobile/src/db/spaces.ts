import { asc, count } from 'drizzle-orm';

import { spaces } from './schema';
import type { NewSpace, Space } from './schema';
import type { Database } from './types';

/** 등록한 순서대로 */
export async function listSpaces(db: Database): Promise<Space[]> {
  return db.select().from(spaces).orderBy(asc(spaces.createdAt), asc(spaces.id));
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

/**
 * 서버에서 받은 종 정보를 기기에 둔다 (SPEC.md 11.1 species_cache).
 * 한 번 받은 종은 비행기 모드에서도 관리 카드를 보여 줄 수 있다.
 */
import { eq } from 'drizzle-orm';

import { speciesCache } from './schema';
import type { NewSpeciesCacheRow, SpeciesCacheRow } from './schema';
import type { Database } from './types';

export async function getCachedSpecies(
  db: Database,
  scientificName: string,
): Promise<SpeciesCacheRow | null> {
  const rows = await db
    .select()
    .from(speciesCache)
    .where(eq(speciesCache.scientificName, scientificName));
  return rows[0] ?? null;
}

/** 받은 종을 저장한다. 이미 있으면 새 값으로 바꾼다 */
export async function cacheSpecies(db: Database, row: NewSpeciesCacheRow): Promise<void> {
  await db
    .insert(speciesCache)
    .values(row)
    .onConflictDoUpdate({ target: speciesCache.scientificName, set: row });
}

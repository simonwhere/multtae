/**
 * 학명으로 종 정보를 얻는다 (SPEC.md 9.4, 4.2).
 * 번들 시드 → 기기 캐시 → 서버 순으로 찾는다. 서버에 닿지 않아도 시드 30종은 늘 된다.
 */
import { cacheSpecies, getCachedSpecies } from '@/db/species-cache';
import { BONSAI_GROUPS } from '@/db/schema';
import type { BonsaiGroup, SpeciesCacheRow } from '@/db/schema';
import type { Database } from '@/db/types';
import { GROUP_CODES } from '@/engine';
import type { GroupCode } from '@/engine';
import { isOneOf } from '@/lib/validate';
import type { KnownSpecies } from '@/plants/registration';
import { findSeedSpecies } from '@/species/seed';

import { callFunction } from './client';

/** species 함수가 주는 행. 검증은 함수가 하지만 여기서도 모양을 확인한다 */
export function toKnownSpecies(row: unknown): KnownSpecies | null {
  if (typeof row !== 'object' || row === null) return null;
  const entry = row as Record<string, unknown>;

  const scientificName = typeof entry.scientific_name === 'string' ? entry.scientific_name.trim() : '';
  if (scientificName === '' || !isOneOf(GROUP_CODES, entry.group_code)) return null;

  const nameKo = typeof entry.name_ko === 'string' && entry.name_ko.trim() !== ''
    ? entry.name_ko.trim()
    : scientificName;

  return {
    scientificName,
    nameKo,
    groupCode: entry.group_code as GroupCode,
    baseInterval: typeof entry.base_interval === 'number' ? entry.base_interval : null,
    bonsaiGroup: isOneOf(BONSAI_GROUPS, entry.bonsai_group)
      ? (entry.bonsai_group as BonsaiGroup)
      : null,
  };
}

const fromCache = (row: SpeciesCacheRow): KnownSpecies => ({
  scientificName: row.scientificName,
  nameKo: row.nameKo ?? row.scientificName,
  groupCode: row.groupCode,
  baseInterval: row.baseInterval,
  bonsaiGroup: row.bonsaiGroup,
});

/**
 * 종 하나를 찾는다. 서버에 없거나 닿지 않으면 null 이고, 그러면 사용자가 식물군을 직접 고른다 (9.4).
 * 서버에서 받은 것은 기기에 저장해 다음부터는 바로 쓴다.
 */
export async function lookupSpecies(
  db: Database,
  scientificName: string,
): Promise<KnownSpecies | null> {
  const seed = findSeedSpecies(scientificName);
  if (seed) return seed;

  const cached = await getCachedSpecies(db, scientificName);
  if (cached) return fromCache(cached);

  const body = await callFunction<{ species: unknown }>('species', {
    search: { name: scientificName },
    // 없는 종은 서버가 만들어 저장한다. 그동안 기다린다 (9.4: 30초 이내)
    timeoutMs: 40_000,
  });

  const known = toKnownSpecies(body?.species);
  if (!known) return null;

  await cacheSpecies(db, {
    scientificName: known.scientificName,
    nameKo: known.nameKo,
    groupCode: known.groupCode,
    baseInterval: known.baseInterval,
    bonsaiGroup: known.bonsaiGroup,
    care: (body?.species as { care?: unknown } | null)?.care ?? null,
    source: 'generated',
    reviewed: false,
    fetchedAt: Date.now(),
  });
  return known;
}

/** 식물 상세의 관리 카드에 쓸 정보 (SPEC 3.4). 받은 적 없으면 null */
export async function getCareInfo(
  db: Database,
  scientificName: string | null,
): Promise<SpeciesCacheRow | null> {
  return scientificName ? getCachedSpecies(db, scientificName) : null;
}

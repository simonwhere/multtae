/**
 * 종 찾기 (SPEC.md 4.2). 번들 시드 30종은 늘 찾히고, 서버에 닿으면 종 DB 전체에서 더 찾는다.
 */
import type { KnownSpecies } from '@/plants/registration';

import { supabaseConfig } from './client';
import { toKnownSpecies } from './species';

const MAX_RESULTS = 20;
const TIMEOUT_MS = 8000;

/**
 * PostgREST 의 or 조건. 쉼표·괄호·중괄호는 문법 글자라 빼고 보낸다.
 * 찾을 글자가 남지 않으면 null 이고, 그러면 서버를 부르지 않는다.
 */
export function buildSearchFilter(query: string): string | null {
  const safe = query.replace(/[,(){}*.\\]/g, '').trim();
  if (safe === '') return null;
  return `(name_ko.ilike.*${safe}*,aliases_ko.cs.{${safe}},scientific_name.ilike.*${safe}*)`;
}

/** 시드를 앞에 두고 서버 결과를 잇는다. 같은 학명은 시드 것을 남긴다 */
export function mergeResults(
  seed: readonly KnownSpecies[],
  server: readonly KnownSpecies[],
): KnownSpecies[] {
  const seen = new Set(seed.map((species) => species.scientificName));
  return [...seed, ...server.filter((species) => !seen.has(species.scientificName))];
}

/** 서버 종 DB 에서 찾는다. 설정이 없거나 닿지 못하면 빈 배열 */
export async function searchServerSpecies(query: string): Promise<KnownSpecies[]> {
  const config = supabaseConfig();
  const filter = buildSearchFilter(query);
  if (!config || !filter) return [];

  const url = new URL(`${config.url}/rest/v1/species`);
  url.searchParams.set('select', 'scientific_name,name_ko,group_code,base_interval,bonsai_group');
  url.searchParams.set('or', filter);
  url.searchParams.set('limit', String(MAX_RESULTS));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url.toString(), { headers: { apikey: config.key }, signal: controller.signal });
    if (!response.ok) return [];

    const rows = (await response.json()) as unknown;
    if (!Array.isArray(rows)) return [];
    return rows.map(toKnownSpecies).filter((species): species is KnownSpecies => species !== null);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

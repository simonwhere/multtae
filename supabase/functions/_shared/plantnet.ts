/**
 * PlantNet 응답을 앱이 쓸 후보로 바꾼다 (SPEC.md 9.1).
 * 남의 서버 응답이라 믿지 않고 모양을 하나하나 확인한다. Deno 런타임과 무관한 순수 함수다.
 */

/** 사진은 3장까지 (SPEC 4.2) */
export const MAX_IMAGES = 3;
/** PlantNet 이 받는 부위 */
export const ORGANS = ['leaf', 'flower', 'fruit', 'bark'] as const;
export type Organ = (typeof ORGANS)[number];

/** 이보다 점수가 낮으면 보여 주지 않는다. 엉뚱한 이름이 섞이는 것보다 검색으로 넘기는 편이 낫다 */
export const MIN_SCORE = 0.01;
/** 앱에 보내는 후보 수 (SPEC 4.2: 후보 3개 중 선택) */
export const MAX_CANDIDATES = 3;

export interface Candidate {
  /** 명명자를 뗀 학명. 종 DB 의 키다 */
  scientificName: string;
  /** PlantNet 이 준 통용명. PlantNet 은 한국어를 주지 못해 영어다 */
  commonNames: string[];
  /** 0~1 */
  score: number;
  /** 종 DB 에서 찾은 국명. 없으면 없다 (SPEC 9.1 "국명이 없으면 종 DB 조회로 보충") */
  nameKo?: string;
}

/** 종 DB 에서 찾은 국명을 후보에 붙인다 */
export function withKoreanNames(
  candidates: readonly Candidate[],
  rows: unknown,
): Candidate[] {
  const byName = new Map<string, string>();
  if (Array.isArray(rows)) {
    for (const row of rows) {
      if (typeof row !== 'object' || row === null) continue;
      const entry = row as { scientific_name?: unknown; name_ko?: unknown };
      if (typeof entry.scientific_name === 'string' && typeof entry.name_ko === 'string') {
        byName.set(entry.scientific_name, entry.name_ko);
      }
    }
  }

  return candidates.map((candidate) => {
    const nameKo = byName.get(candidate.scientificName);
    return nameKo ? { ...candidate, nameKo } : candidate;
  });
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

function names(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((name): name is string => typeof name === 'string' && name.trim() !== '');
}

export function parseIdentifyResponse(body: unknown): Candidate[] {
  const results = isObject(body) && Array.isArray(body.results) ? body.results : [];
  const candidates: Candidate[] = [];

  for (const entry of results) {
    if (candidates.length >= MAX_CANDIDATES) break;
    if (!isObject(entry) || typeof entry.score !== 'number' || !Number.isFinite(entry.score)) continue;

    const species = isObject(entry.species) ? entry.species : null;
    const scientificName = species && typeof species.scientificNameWithoutAuthor === 'string'
      ? species.scientificNameWithoutAuthor.trim()
      : '';
    if (scientificName === '') continue;

    candidates.push({ scientificName, commonNames: names(species?.commonNames), score: entry.score });
  }

  return candidates;
}

/** 점수가 너무 낮으면 버린다. 남는 것이 없으면 앱은 텍스트 검색으로 넘어간다 */
export function pickCandidates(candidates: readonly Candidate[]): Candidate[] {
  return candidates.filter((candidate) => candidate.score >= MIN_SCORE);
}

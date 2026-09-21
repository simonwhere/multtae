/**
 * 사진으로 식물 종을 알아본다 (SPEC.md 9.1, 4.2).
 * 사진은 Edge Function 으로만 보내고 서버에 저장하지 않는다 (CLAUDE.md 절대 규칙).
 */
import { photoFile } from '@/photos/photo-store';

import { callFunction, FunctionError } from './client';

/** PlantNet 이 받는 부위. 지금은 잎으로만 보낸다. 부위 태그 UI 는 SPEC 3-5 뒤로 미뤘다 */
export const DEFAULT_ORGAN = 'leaf';

export interface IdentifyCandidate {
  scientificName: string;
  commonNames: string[];
  /** 0~1 */
  score: number;
  /** 종 DB 에서 찾은 국명. 없으면 학명을 보여 준다 */
  nameKo?: string;
}

export type IdentifyOutcome =
  /** 후보를 받았다. 비어 있을 수도 있다 (닮은 종을 못 찾음) */
  | { kind: 'candidates'; candidates: IdentifyCandidate[] }
  /** 오늘 인식이 많았다. 앱은 텍스트 검색으로 넘어간다 (9.1 한도 방어) */
  | { kind: 'limit' }
  /** 서버 설정이 없거나 닿지 않는다. 검색으로 넘어간다 */
  | { kind: 'unavailable' };

function isCandidate(value: unknown): value is IdentifyCandidate {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.scientificName === 'string' &&
    entry.scientificName !== '' &&
    typeof entry.score === 'number' &&
    Array.isArray(entry.commonNames)
  );
}

/** 사진 경로(문서 폴더 기준 상대 경로) 들로 인식을 부른다 */
export async function identifyPlant(photoPaths: readonly string[]): Promise<IdentifyOutcome> {
  if (photoPaths.length === 0) return { kind: 'candidates', candidates: [] };

  try {
    // 사진을 읽는 것도 실패할 수 있다. 그래도 등록은 검색으로 이어진다
    const form = new FormData();
    for (const [index, path] of photoPaths.entries()) {
      form.append('images', photoFile(path), `plant-${index + 1}.jpg`);
      form.append('organs', DEFAULT_ORGAN);
    }

    const body = await callFunction<{ candidates: unknown }>('identify', {
      method: 'POST',
      body: form,
    });
    if (!body) return { kind: 'unavailable' };

    const candidates = Array.isArray(body.candidates) ? body.candidates.filter(isCandidate) : [];
    return { kind: 'candidates', candidates };
  } catch (error) {
    if (error instanceof FunctionError && error.code === 'limit') return { kind: 'limit' };
    return { kind: 'unavailable' };
  }
}

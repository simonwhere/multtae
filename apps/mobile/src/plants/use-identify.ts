import { useCallback, useState } from 'react';

import { identifyPlant } from '@/api/identify';
import type { IdentifyCandidate } from '@/api/identify';
import { lookupSpecies } from '@/api/species';
import { db } from '@/db/client';

import type { KnownSpecies } from './registration';

export type IdentifyState =
  | { status: 'idle' }
  | { status: 'loading' }
  /** 후보를 받았다. 비어 있으면 "닮은 식물을 못 찾았어요" */
  | { status: 'done'; candidates: IdentifyCandidate[] }
  /** 한도를 넘었거나 서버에 닿지 못했다. 검색으로 고른다 */
  | { status: 'failed'; reason: 'limit' | 'unavailable' };

/**
 * 사진 인식과 그 결과에서 종을 고르는 일 (SPEC.md 4.2, 9.1).
 * 어떤 이유로든 실패하면 앱은 텍스트 검색으로 넘어가고 등록은 계속된다.
 */
export function useIdentify() {
  const [state, setState] = useState<IdentifyState>({ status: 'idle' });
  /** 후보를 눌렀을 때 종 정보를 받아 오는 동안 표시한다 */
  const [choosing, setChoosing] = useState<string | null>(null);

  const identify = useCallback(async (photoPaths: readonly string[]) => {
    setState({ status: 'loading' });
    const outcome = await identifyPlant(photoPaths);

    setState(
      outcome.kind === 'candidates'
        ? { status: 'done', candidates: outcome.candidates }
        : { status: 'failed', reason: outcome.kind === 'limit' ? 'limit' : 'unavailable' },
    );
  }, []);

  /** 후보 하나의 종 정보를 받아 온다. 서버에 없으면 null 이고 사용자가 식물군을 고른다 */
  const chooseCandidate = useCallback(
    async (scientificName: string): Promise<KnownSpecies | null> => {
      setChoosing(scientificName);
      try {
        return await lookupSpecies(db, scientificName);
      } catch {
        return null;
      } finally {
        setChoosing(null);
      }
    },
    [],
  );

  const reset = useCallback(() => setState({ status: 'idle' }), []);

  return { state, choosing, identify, chooseCandidate, reset };
}

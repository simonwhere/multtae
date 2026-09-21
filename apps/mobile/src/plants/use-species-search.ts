import { useEffect, useState } from 'react';

import { searchServerSpecies } from '@/api/species-search';
import { mergeResults } from '@/api/species-search';
import { searchSpecies } from '@/species/seed';

import type { KnownSpecies } from './registration';

/** 입력이 멎기를 기다리는 시간. 글자마다 서버를 부르지 않는다 */
const DEBOUNCE_MS = 300;

/**
 * 종 찾기 (SPEC.md 4.2). 번들 시드는 바로 보여 주고, 서버 결과가 오면 뒤에 잇는다.
 * 서버에 닿지 못해도 시드 30종은 늘 찾힌다.
 */
export function useSpeciesSearch(query: string): { results: KnownSpecies[]; searching: boolean } {
  const seed = searchSpecies(query);
  const [server, setServer] = useState<KnownSpecies[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (query.trim() === '') {
      setServer([]);
      return;
    }

    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(() => {
      void searchServerSpecies(query).then((found) => {
        if (cancelled) return;
        setServer(found);
        setSearching(false);
      });
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  return { results: mergeResults(seed, server), searching };
}

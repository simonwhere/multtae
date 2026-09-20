import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { db } from '@/db/client';
import { listPlantsWithSpace } from '@/db/plants';
import type { PlantWithSpace } from '@/db/plants';
import type { Space } from '@/db/schema';
import { listSpaces } from '@/db/spaces';

export interface Garden {
  spaces: Space[];
  plants: PlantWithSpace[];
  /** 읽은 시각. 한 화면의 카드가 모두 같은 "오늘"을 보게 한다 */
  loadedAt: number;
}

/** 화면에 들어올 때마다(등록·시트에서 돌아올 때 포함) 공간과 식물을 다시 읽는다. null 은 불러오는 중 */
export function useGarden(): { garden: Garden | null; reload: () => void } {
  const [garden, setGarden] = useState<Garden | null>(null);

  const reload = useCallback(() => {
    void Promise.all([listSpaces(db), listPlantsWithSpace(db)]).then(([spaces, plants]) => {
      setGarden({ spaces, plants, loadedAt: Date.now() });
    });
  }, []);

  useFocusEffect(reload);

  return { garden, reload };
}

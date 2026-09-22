import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import { db } from '@/db/client';
import { listPlantsWithSpace } from '@/db/plants';
import type { Plant, Space } from '@/db/schema';
import { getSpace } from '@/db/spaces';
import { usePlantUi } from '@/plants/ui-store';

export interface SpaceDetail {
  space: Space;
  /** 이 공간에 놓인 식물. 물 줄 날이 가까운 순서 */
  plants: Plant[];
  /** 읽은 시각. 화면의 모든 값이 같은 "오늘"을 보게 한다 */
  loadedAt: number;
}

/** 공간 상세에 필요한 것을 읽는다. null 은 불러오는 중, 'missing' 은 지웠거나 없는 공간 */
export function useSpaceDetail(spaceId: string): {
  detail: SpaceDetail | 'missing' | null;
  reload: () => void;
} {
  const [detail, setDetail] = useState<SpaceDetail | 'missing' | null>(null);

  const reload = useCallback(() => {
    void Promise.all([getSpace(db, spaceId), listPlantsWithSpace(db)]).then(([space, all]) => {
      if (!space) {
        setDetail('missing');
        return;
      }
      setDetail({
        space,
        plants: all.filter((item) => item.space.id === spaceId).map((item) => item.plant),
        loadedAt: Date.now(),
      });
    });
  }, [spaceId]);

  useFocusEffect(reload);

  // 빛을 바꿔 물 주는 날을 다시 셌을 때도 다시 읽는다
  const gardenVersion = usePlantUi((state) => state.gardenVersion);
  useEffect(() => {
    if (gardenVersion > 0) reload();
  }, [gardenVersion, reload]);

  return { detail, reload };
}

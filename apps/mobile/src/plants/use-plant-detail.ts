import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import { db } from '@/db/client';
import { getPlantWithSpace } from '@/db/plants';
import type { PlantWithSpace } from '@/db/plants';
import type { WateringLog } from '@/db/schema';
import { listPlantWaterings } from '@/db/watering';

import { usePlantUi } from './ui-store';

/** 3회 연속 안내(5.4)를 가리려면 흙 상태를 고르지 않은 기록을 건너뛰어야 해서 넉넉히 읽는다 */
const WATERINGS_TO_LOAD = 12;

export interface PlantDetail extends PlantWithSpace {
  /** 최근 물주기 기록부터 */
  waterings: WateringLog[];
  /** 읽은 시각. 화면의 모든 값이 같은 "오늘"을 보게 한다 */
  loadedAt: number;
}

/** 식물 상세에 필요한 것을 읽는다. 시트에서 돌아올 때마다 다시 읽는다. null 은 불러오는 중, 'missing' 은 없는 식물 */
export function usePlantDetail(plantId: string): PlantDetail | 'missing' | null {
  const [detail, setDetail] = useState<PlantDetail | 'missing' | null>(null);

  const reload = useCallback(() => {
    void Promise.all([
      getPlantWithSpace(db, plantId),
      listPlantWaterings(db, plantId, WATERINGS_TO_LOAD),
    ]).then(([item, waterings]) => {
      setDetail(item ? { ...item, waterings, loadedAt: Date.now() } : 'missing');
    });
  }, [plantId]);

  useFocusEffect(reload);

  // 계절이 바뀌어 다음 물주기를 고쳐 썼을 때도 다시 읽는다
  const gardenVersion = usePlantUi((state) => state.gardenVersion);
  useEffect(() => {
    if (gardenVersion > 0) reload();
  }, [gardenVersion, reload]);

  return detail;
}

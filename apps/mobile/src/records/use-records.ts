import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import { db } from '@/db/client';
import { listRecentEvents } from '@/db/events';
import type { EventWithPlant } from '@/db/events';
import { listPlantsWithSpace } from '@/db/plants';
import type { PlantWithSpace } from '@/db/plants';
import type { Space } from '@/db/schema';
import { listSpaces } from '@/db/spaces';
import { listRecentWaterings } from '@/db/watering';
import type { WateringWithPlant } from '@/db/watering';
import { usePlantUi } from '@/plants/ui-store';
import { useFreshDay } from '@/plants/use-fresh-day';

/** 가정에서 쓰기에 넉넉한 양. 식물 20개가 두세 달 쌓는 기록이다 */
const RECENT = 500;

export interface Records {
  waterings: WateringWithPlant[];
  events: EventWithPlant[];
  plants: PlantWithSpace[];
  spaces: Space[];
  loadedAt: number;
}

/** 기록 탭에 필요한 것을 읽는다. 들어올 때마다, 그리고 다른 화면에서 식물이 바뀌면 다시 읽는다 */
export function useRecords(): Records | null {
  const [records, setRecords] = useState<Records | null>(null);

  const reload = useCallback(() => {
    void Promise.all([
      listRecentWaterings(db, RECENT),
      listRecentEvents(db, RECENT),
      listPlantsWithSpace(db),
      listSpaces(db),
    ]).then(([waterings, events, plants, spaces]) =>
      setRecords({ waterings, events, plants, spaces, loadedAt: Date.now() }),
    );
  }, []);

  useFocusEffect(reload);
  useFreshDay(reload);

  const gardenVersion = usePlantUi((state) => state.gardenVersion);
  useEffect(() => {
    if (gardenVersion > 0) reload();
  }, [gardenVersion, reload]);

  return records;
}

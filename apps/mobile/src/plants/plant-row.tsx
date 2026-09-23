import { memo } from 'react';

import type { PlantWithSpace } from '@/db/plants';

import { PlantCard } from './plant-card';
import { classifyPlant } from './today';

export interface PlantRowProps {
  item: PlantWithSpace;
  /** 목록의 모든 카드가 같은 "오늘"을 보게 밖에서 받는다 */
  now: number;
  utcOffsetMinutes: number;
  onPress: (plantId: string) => void;
}

/**
 * 목록 한 줄. 스크롤하는 동안 다시 그리지 않게 memo 로 감싼다 (SPEC.md 15 성능).
 * 누를 때 쓰는 함수는 식물 id 만 넘겨받아, 화면마다 새 함수를 만들지 않는다.
 */
export const PlantRow = memo(function PlantRow({
  item,
  now,
  utcOffsetMinutes,
  onPress,
}: PlantRowProps) {
  return (
    <PlantCard
      {...item}
      soil={classifyPlant(item.plant, now, utcOffsetMinutes)}
      onPress={() => onPress(item.plant.id)}
    />
  );
});

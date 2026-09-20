import { AppText, useColors } from '@/ui';

import { formatDaysLeft } from './formula';

/**
 * 다음 물주기까지 남은 날. "D-3" 은 큰 세리프 숫자로 쓰고 (SPEC 14.3), 밀린 날은 한글이라 제목 서체로 쓴다.
 * water 는 오늘 물주기 강조에만, 밀림은 경고색 (14.2).
 */
export function DaysLeft({ daysLeft }: { daysLeft: number }) {
  const colors = useColors();

  if (daysLeft < 0) {
    return (
      <AppText variant="titleSm" color={colors.warn}>
        {formatDaysLeft(daysLeft)}
      </AppText>
    );
  }
  return (
    <AppText variant="numeralSm" color={daysLeft === 0 ? colors.water : undefined}>
      {formatDaysLeft(daysLeft)}
    </AppText>
  );
}

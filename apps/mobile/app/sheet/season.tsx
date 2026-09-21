import { StyleSheet, View } from 'react-native';

import { currentCoefficients } from '@/coefficients';
import { nextSeasonChange, toSeoulDate } from '@/engine';
import { ko } from '@/i18n/ko';
import { formatMonthDay } from '@/plants/format';
import { nowContext } from '@/plants/use-now';
import { AppText, spacing } from '@/ui';

// 계절 설명 시트 (SPEC 3.2 상단 배지를 누르면 뜬다)
export default function SeasonSheet() {
  const { now, season } = nowContext();
  // 계절 경계는 Asia/Seoul 날짜 기준이다 (SPEC 15)
  const next = nextSeasonChange(toSeoulDate(now), currentCoefficients().seasonBounds);

  return (
    <View style={styles.sheet}>
      <AppText variant="titleSm" accessibilityRole="header">
        {ko.seasonInfo.title(ko.seasonMode[season])}
      </AppText>
      <AppText>{ko.seasonInfo[season]}</AppText>
      {next ? (
        <AppText variant="caption">
          {ko.seasonInfo.next(ko.seasonMode[next.season], formatMonthDay(next.date))}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    gap: spacing.md,
    padding: spacing.lg,
    paddingTop: spacing.xl,
    // 하단 안전 영역은 시트가 알아서 띄운다
    paddingBottom: spacing.xl,
  },
});

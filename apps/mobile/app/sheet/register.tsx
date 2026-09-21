import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { db } from '@/db/client';
import { countSpaces } from '@/db/spaces';
import { ko } from '@/i18n/ko';
import { AppText, Button, spacing } from '@/ui';

// + 버튼을 누르면 뜨는 시트: 식물과 공간 중 무엇을 등록할지 (SPEC 3)
export default function RegisterSheet() {
  const router = useRouter();
  /** null 은 세는 중 */
  const [spaceCount, setSpaceCount] = useState<number | null>(null);

  useEffect(() => {
    void countSpaces(db).then(setSpaceCount);
  }, []);

  const hasSpace = (spaceCount ?? 0) > 0;

  return (
    <View style={styles.sheet}>
      <AppText variant="titleSm" accessibilityRole="header">
        {ko.registerSheet.title}
      </AppText>
      {/* 공간을 먼저 등록하고 식물을 놓는다 (SPEC 1) */}
      <Button
        label={ko.today.registerPlant}
        variant={hasSpace ? 'primary' : 'secondary'}
        disabled={!hasSpace}
        onPress={() => router.replace('/register/plant')}
      />
      {spaceCount === 0 ? (
        <AppText variant="caption">{ko.registerSheet.needSpace}</AppText>
      ) : null}
      <Button
        label={ko.today.registerSpace}
        variant={hasSpace ? 'secondary' : 'primary'}
        onPress={() => router.replace('/register/space')}
      />
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

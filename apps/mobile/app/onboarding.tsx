import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { db } from '@/db/client';
import { setSetting } from '@/db/settings';
import { ko } from '@/i18n/ko';
import { askPermissionOnce } from '@/notifications';
import { AppText, Button, spacing, Sprig, TextButton, useColors } from '@/ui';

type Page = 'place' | 'notify';

// 온보딩 (SPEC 3.1): 첫 실행에 한 번. 공간부터라는 것 한 줄과 알림 권한, 그리고 바로 공간 등록으로.
export default function OnboardingScreen() {
  const colors = useColors();
  const router = useRouter();
  const [page, setPage] = useState<Page>('place');
  const t = ko.onboarding;

  /** 두 번 다시 띄우지 않는다. 건너뛰면 탭으로, 끝까지 보면 공간 등록으로 */
  async function finish(next: '/register/space' | '/') {
    await setSetting(db, 'onboarding_done', 'true');
    router.replace(next);
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.paper }]}>
      <View style={styles.top}>
        <TextButton label={t.skip} onPress={() => void finish('/')} />
      </View>

      <View style={styles.body}>
        <Sprig size={160} />
        <View style={styles.text}>
          <AppText variant="titleLg" accessibilityRole="header">
            {page === 'place' ? t.placeTitle : t.notifyTitle}
          </AppText>
          <AppText>{page === 'place' ? t.placeBody : t.notifyBody}</AppText>
        </View>
      </View>

      <View style={styles.actions}>
        {page === 'place' ? (
          <Button label={t.next} onPress={() => setPage('notify')} />
        ) : (
          <>
            <Button
              label={t.allow}
              onPress={() => {
                // 거부해도 그대로 넘어간다 (3.1). 오늘 탭 배너가 다시 안내한다
                void askPermissionOnce().then(() => finish('/register/space'));
              }}
            />
            <Button
              label={t.later}
              variant="surface"
              onPress={() => void finish('/register/space')}
            />
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: spacing.xl - spacing.xs,
  },
  top: {
    alignItems: 'flex-end',
    paddingVertical: spacing.sm,
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
  },
  text: {
    gap: spacing.md,
  },
  actions: {
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
});

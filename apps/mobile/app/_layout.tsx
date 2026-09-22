import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { useCoefficients } from '@/coefficients/use-coefficients';
import { db } from '@/db/client';
import migrations from '@/db/migrations/migrations';
import { ko } from '@/i18n/ko';
import { useNotifications } from '@/notifications';
import { useWeather } from '@/weather/use-weather';
import { AppText, radius, spacing, useColors } from '@/ui';
import { fontAssets } from '@/ui/fonts';

// 서체와 DB 가 준비될 때까지 스플래시를 둔다.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colors = useColors();
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  const { success: migrated, error: migrationError } = useMigrations(db, migrations);

  // 계수는 DB 에 저장해 둔 마지막 서버 값을 먼저 읽는다 (SPEC 11.2). 없으면 번들 기본값이다
  const coefficientsLoaded = useCoefficients(migrated);

  // 서체를 못 읽어도 시스템 서체로 계속 간다. DB 는 없으면 안 된다.
  const ready =
    (fontsLoaded || fontError !== null) &&
    ((migrated && coefficientsLoaded) || migrationError !== undefined);

  useEffect(() => {
    if (ready) SplashScreen.hide();
  }, [ready]);

  // 알림은 DB 와 계수를 읽어서 짠다. 둘 다 준비된 뒤에 시작한다
  useNotifications(migrated && coefficientsLoaded);
  useWeather(migrated && coefficientsLoaded);

  if (!ready) {
    return null;
  }

  if (migrationError) {
    return (
      <View style={[styles.center, { backgroundColor: colors.paper }]}>
        <AppText>{ko.error.database}</AppText>
      </View>
    );
  }

  const sheetOptions = {
    presentation: 'formSheet',
    sheetAllowedDetents: 'fitToContents',
    sheetGrabberVisible: true,
    sheetCornerRadius: radius.sheet,
    contentStyle: { backgroundColor: colors.surface },
  } as const;

  return (
    // 스와이프 동작(오늘 탭 카드)에 필요하다
    <GestureHandlerRootView style={styles.root}>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper } }}>
        <Stack.Screen name="(tabs)" />
        {/* 등록 플로우는 어디서든 모달로 뜬다 (SPEC 3) */}
        <Stack.Screen name="register/space" options={{ presentation: 'modal' }} />
        <Stack.Screen name="register/plant" options={{ presentation: 'modal' }} />
        <Stack.Screen name="plant/[id]" />
        <Stack.Screen name="space/[id]" />
        <Stack.Screen name="settings" />
        {/* 상태 진단은 사진을 고르는 모달, 결과는 기록 탭에서도 여는 화면이다 (8.1) */}
        <Stack.Screen name="diagnose/[id]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="diagnosis/[eventId]" />
        {/* 지역 목록은 길어서 스크롤되는 모달로 띄운다 */}
        <Stack.Screen name="sheet/region" options={{ presentation: 'modal' }} />
        {/* 시트는 내용 높이만큼만 올라온다. 그래서 시트 화면에는 flex: 1 과 ScrollView 를 쓰지 않는다 */}
        {['sheet/watered', 'sheet/season', 'sheet/register', 'sheet/space-edit', 'sheet/time'].map((name) => (
          <Stack.Screen key={name} name={name} options={sheetOptions} />
        ))}
        {/* 공간 이동은 목록이 길어질 수 있어 스크롤되는 모달로 띄운다 */}
        <Stack.Screen
          name="sheet/plant-edit"
          options={({ route }) =>
            (route.params as { field?: string } | undefined)?.field === 'move'
              ? { presentation: 'modal' }
              : sheetOptions
          }
        />
      </Stack>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
});

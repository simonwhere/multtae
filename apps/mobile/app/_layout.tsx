import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { db } from '@/db/client';
import migrations from '@/db/migrations/migrations';
import { ko } from '@/i18n/ko';
import { AppText, spacing, useColors } from '@/ui';
import { fontAssets } from '@/ui/fonts';

// 서체와 DB 가 준비될 때까지 스플래시를 둔다.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colors = useColors();
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  const { success: migrated, error: migrationError } = useMigrations(db, migrations);

  // 서체를 못 읽어도 시스템 서체로 계속 간다. DB 는 없으면 안 된다.
  const ready = (fontsLoaded || fontError !== null) && (migrated || migrationError !== undefined);

  useEffect(() => {
    if (ready) SplashScreen.hide();
  }, [ready]);

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

  return (
    <>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper } }}>
        {/* 등록 플로우는 어디서든 모달로 뜬다 (SPEC 3) */}
        <Stack.Screen name="register/space" options={{ presentation: 'modal' }} />
      </Stack>
    </>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
});

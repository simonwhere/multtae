import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

import { db } from '@/db/client';
import migrations from '@/db/migrations/migrations';
import { ko } from '@/i18n/ko';
import { typography } from '@/ui/tokens';
import { useColors } from '@/ui/use-colors';

export default function RootLayout() {
  const colors = useColors();
  const { success, error } = useMigrations(db, migrations);

  if (error) {
    return (
      <View style={[styles.center, { backgroundColor: colors.paper }]}>
        <Text style={[typography.body, { color: colors.warn }]}>{ko.error.database}</Text>
      </View>
    );
  }

  if (!success) {
    return <View style={[styles.center, { backgroundColor: colors.paper }]} />;
  }

  return (
    <>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper } }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
});

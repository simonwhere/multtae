import { useRouter } from 'expo-router';
import { FlatList, Linking, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ko } from '@/i18n/ko';
import licenses from '@/legal/licenses.json';
import { AppText, BackButton, Card, spacing, useColors } from '@/ui';

type Row = (typeof licenses)[number];

/** 오픈소스 라이선스 (SPEC 3.6). 목록은 scripts/licenses.mjs 가 package.json 에서 만든다 */
export default function LicensesScreen() {
  const colors = useColors();
  const router = useRouter();
  const t = ko.licenses;

  const open = (row: Row) => {
    if (row.repository) void Linking.openURL(row.repository).catch(() => undefined);
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: colors.paper }]}>
      <View style={styles.header}>
        <BackButton onPress={() => (router.canGoBack() ? router.back() : router.replace('/settings'))} />
      </View>
      <FlatList
        data={licenses}
        keyExtractor={(row) => row.name}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.intro}>
            <AppText variant="titleLg" accessibilityRole="header">
              {t.title}
            </AppText>
            <AppText variant="caption">{t.intro}</AppText>
          </View>
        }
        ItemSeparatorComponent={Gap}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole={item.repository ? 'link' : undefined}
            accessibilityLabel={`${item.name} ${item.version} ${item.license}`}
            disabled={!item.repository}
            onPress={() => open(item)}
            style={({ pressed }) => [pressed && styles.pressed]}>
            <Card style={styles.card}>
              <AppText variant="label">{item.name}</AppText>
              <AppText variant="caption">
                {item.version} · {item.license}
              </AppText>
              {item.repository ? (
                <AppText variant="caption" numberOfLines={1}>
                  {item.repository}
                </AppText>
              ) : null}
            </Card>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const Gap = () => <View style={styles.gap} />;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    paddingHorizontal: spacing.xl - spacing.xs,
    paddingVertical: spacing.sm,
  },
  content: {
    paddingHorizontal: spacing.xl - spacing.xs,
    paddingBottom: spacing.xl * 2,
  },
  intro: {
    gap: spacing.sm,
    paddingBottom: spacing.lg,
  },
  card: {
    gap: spacing.xs,
  },
  gap: {
    height: spacing.sm,
  },
  pressed: {
    opacity: 0.6,
  },
});

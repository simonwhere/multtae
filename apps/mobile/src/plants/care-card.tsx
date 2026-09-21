import { StyleSheet, View } from 'react-native';

import type { SpeciesCacheRow } from '@/db/schema';
import { ko } from '@/i18n/ko';
import { AppText, Card, spacing, useColors } from '@/ui';

/** 종 DB 의 care 필드 (SPEC 10.1) */
interface CareInfo {
  light?: unknown;
  water?: unknown;
  humidity?: unknown;
  soil?: unknown;
  temp_min?: unknown;
  temp_max?: unknown;
}

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : null;

const number = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

function Row({ label, value }: { label: string; value: string }) {
  const colors = useColors();

  return (
    <View style={styles.row}>
      <AppText variant="caption" color={colors.sub} style={styles.label}>
        {label}
      </AppText>
      <AppText style={styles.value}>{value}</AppText>
    </View>
  );
}

/**
 * 키우는 법 (SPEC.md 3.4 관리 카드). 종 DB 에서 받아 둔 것이 있을 때만 보여 준다.
 * 받은 적이 없으면(시드 30종이거나 오프라인) 아무것도 그리지 않는다.
 */
export function CareCard({ species }: { species: SpeciesCacheRow | null }) {
  const colors = useColors();
  const care = (species?.care ?? null) as CareInfo | null;
  if (!care) return null;

  const t = ko.plantDetail;
  const tempMin = number(care.temp_min);
  const tempMax = number(care.temp_max);
  const temp =
    tempMin !== null && tempMax !== null
      ? t.careTempRange(tempMin, tempMax)
      : tempMin !== null
        ? t.careTempMin(tempMin)
        : null;

  const rows = [
    [t.careLight, text(care.light)],
    [t.careWater, text(care.water)],
    [t.careHumidity, text(care.humidity)],
    [t.careTemp, temp],
    [t.careSoil, text(care.soil)],
  ].filter((entry): entry is [string, string] => entry[1] !== null);

  if (rows.length === 0) return null;

  return (
    <View style={styles.section}>
      <AppText variant="label" style={styles.title}>
        {t.care}
      </AppText>
      <Card style={styles.card}>
        {rows.map(([label, value]) => (
          <Row key={label} label={label} value={value} />
        ))}
        {species?.toxicPet ? (
          <AppText variant="caption" color={colors.berry}>
            {t.careToxic}
          </AppText>
        ) : null}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
  },
  title: {
    marginHorizontal: spacing.xs,
  },
  card: {
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  label: {
    width: 36,
    paddingTop: 2,
  },
  value: {
    flex: 1,
  },
});

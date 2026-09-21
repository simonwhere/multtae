import { StyleSheet, View } from 'react-native';

import type { PlantTask } from '@/db/schema';
import type { CalendarDate } from '@/engine';
import { ko } from '@/i18n/ko';
import { AppText, Card, spacing, Tag, TextButton, useColors } from '@/ui';

import { activeTasks, upcomingTaskMonth } from './tasks';

export interface TaskCardProps {
  tasks: readonly PlantTask[];
  today: CalendarDate;
  onToggle: (task: PlantTask, done: boolean) => void;
}

/**
 * 분재 작업 캘린더 (SPEC.md 3.4, 6.2). 이번 달에 할 일을 보여 주고, 마치면 표시한다.
 * 완료는 해마다 다시 돌아온다. 분재가 아니면 작업이 없어 아무것도 그리지 않는다.
 */
export function TaskCard({ tasks, today, onToggle }: TaskCardProps) {
  const colors = useColors();
  if (tasks.length === 0) return null;

  const t = ko.plantDetail;
  const now = activeTasks(tasks, today);
  const upcoming = upcomingTaskMonth(tasks, today.month);
  // 이번 달 것을 이미 마쳤는지
  const doneThisMonth = tasks.filter(
    (task) => task.doneYear === today.year && now.every((open) => open.id !== task.id),
  );

  return (
    <View style={styles.section}>
      <AppText variant="label" style={styles.title}>
        {t.tasks}
      </AppText>
      <Card style={styles.card}>
        {now.map((task) => (
          <View key={task.id} style={styles.row}>
            <View style={styles.text}>
              <AppText>{task.labelKo}</AppText>
              <AppText variant="caption">
                {t.taskMonths(task.monthStart, task.monthEnd)}
              </AppText>
            </View>
            <TextButton label={t.taskDone} onPress={() => onToggle(task, true)} />
          </View>
        ))}

        {doneThisMonth.map((task) => (
          <View key={task.id} style={styles.row}>
            <View style={styles.text}>
              <AppText color={colors.sub}>{task.labelKo}</AppText>
            </View>
            <Tag label={ko.today.doneBadge} />
          </View>
        ))}

        {now.length === 0 && upcoming ? (
          <AppText variant="caption">{t.taskNext(upcoming.month, upcoming.labelKo)}</AppText>
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
    alignItems: 'center',
    gap: spacing.md,
  },
  text: {
    flex: 1,
    gap: 2,
  },
});

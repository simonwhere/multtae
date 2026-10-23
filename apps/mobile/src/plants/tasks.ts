/**
 * 분재 작업 캘린더 (SPEC.md 6.2). 등록할 때 수종군 기준표를 식물별로 복사해 두고,
 * 이번 달에 할 일을 오늘 탭과 식물 상세에 보여 준다. 완료는 해마다 다시 돌아온다.
 * 화면·DB 와 무관한 순수 함수다.
 */
import type { BonsaiGroup, NewPlantTask, PlantTask } from '../db/schema';
import type { CalendarDate } from '../engine';
import { bonsaiTasksFor } from './bonsai-tasks';

/** 시작 월이 끝 월보다 크면 해를 넘기는 작업이다 (예: 철사걸이 11~2월) */
export function isActiveMonth(task: Pick<PlantTask, 'monthStart' | 'monthEnd'>, month: number): boolean {
  const { monthStart, monthEnd } = task;
  return monthStart <= monthEnd
    ? month >= monthStart && month <= monthEnd
    : month >= monthStart || month <= monthEnd;
}

/** 이번 달에 할 작업. 올해 이미 마친 것은 뺀다 */
export function activeTasks(tasks: readonly PlantTask[], today: CalendarDate): PlantTask[] {
  return tasks.filter(
    (task) => isActiveMonth(task, today.month) && task.doneYear !== today.year,
  );
}

/** 이번 달 뒤로 가장 가까운 작업. 올해 남은 것이 없으면 내년 첫 작업 */
export function upcomingTaskMonth(
  tasks: readonly PlantTask[],
  month: number,
): { taskCode: string; labelKo: string; month: number } | null {
  if (tasks.length === 0) return null;

  // 몇 달 뒤인지. 이번 달에 시작하는 것은 이미 "이번 달 할 일"에 나오므로 한 해 뒤로 민다
  const monthsAway = (start: number) => (start - month + 12) % 12 || 12;
  const next = [...tasks].sort((a, b) => monthsAway(a.monthStart) - monthsAway(b.monthStart))[0];

  return next
    ? { taskCode: next.taskCode, labelKo: next.labelKo, month: next.monthStart }
    : null;
}

/**
 * 분재의 작업 행을 만든다. 서버의 bonsai_tasks 는 AI 가 만들어 검수가 적으므로 쓰지 않고,
 * 수종군과 학명으로 정해지는 기준표(bonsai-tasks.ts)를 복사한다 (SPEC 6.2, 10-1). 분재가 아니면 만들지 않는다.
 */
export function taskRowsFor(
  plantId: string,
  plant: { isBonsai: boolean; bonsaiGroup: BonsaiGroup | null; scientificName: string | null },
  newId: () => string,
): NewPlantTask[] {
  if (!plant.isBonsai) return [];
  return bonsaiTasksFor(plant.bonsaiGroup, plant.scientificName).map((task) => ({
    id: newId(),
    plantId,
    ...task,
  }));
}

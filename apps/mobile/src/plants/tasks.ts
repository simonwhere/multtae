/**
 * 분재 작업 캘린더 (SPEC.md 6.2). 종 DB 의 bonsai_tasks 를 등록할 때 식물별로 복사해 두고,
 * 이번 달에 할 일을 오늘 탭과 식물 상세에 보여 준다. 완료는 해마다 다시 돌아온다.
 * 화면·DB 와 무관한 순수 함수다.
 */
import type { NewPlantTask, PlantTask } from '../db/schema';
import type { CalendarDate } from '../engine';

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

  // 이번 달부터 세어 몇 달 뒤인지. 같은 달이면 0 이라 가장 먼저다
  const monthsAway = (start: number) => (start - month + 12) % 12;
  const next = [...tasks].sort((a, b) => monthsAway(a.monthStart) - monthsAway(b.monthStart))[0];

  return next
    ? { taskCode: next.taskCode, labelKo: next.labelKo, month: next.monthStart }
    : null;
}

const isMonth = (value: unknown): value is number =>
  Number.isInteger(value) && (value as number) >= 1 && (value as number) <= 12;

/**
 * 종 DB 의 bonsai_tasks 를 식물의 작업 행으로. 분재가 아니면 만들지 않는다.
 * 서버가 만든 값이라 모양을 하나하나 확인한다.
 */
export function taskRowsFor(
  plantId: string,
  source: unknown,
  isBonsai: boolean,
  newId: () => string,
): NewPlantTask[] {
  if (!isBonsai || !Array.isArray(source)) return [];

  const rows: NewPlantTask[] = [];
  for (const entry of source) {
    if (typeof entry !== 'object' || entry === null) continue;
    const task = entry as Record<string, unknown>;
    const taskCode = typeof task.task_code === 'string' ? task.task_code.trim() : '';
    const labelKo = typeof task.label_ko === 'string' ? task.label_ko.trim() : '';
    if (taskCode === '' || labelKo === '') continue;
    if (!isMonth(task.month_start) || !isMonth(task.month_end)) continue;

    rows.push({
      id: newId(),
      plantId,
      taskCode,
      monthStart: task.month_start,
      monthEnd: task.month_end,
      labelKo,
    });
  }
  return rows;
}

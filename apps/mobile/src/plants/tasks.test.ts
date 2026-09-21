import { describe, expect, it } from 'vitest';

import type { PlantTask } from '../db/schema';
import { activeTasks, taskRowsFor, upcomingTaskMonth } from './tasks';

const task = (patch: Partial<PlantTask>): PlantTask => ({
  id: 'task-1',
  plantId: 'plant-1',
  taskCode: 'pinch_candles',
  monthStart: 5,
  monthEnd: 6,
  labelKo: '순따기',
  doneYear: null,
  ...patch,
});

describe('activeTasks: 이번 달에 할 작업 (SPEC.md 6.2)', () => {
  it('시작과 끝 사이의 달이면 보여 준다', () => {
    const tasks = [task({})];

    expect(activeTasks(tasks, { year: 2026, month: 5, day: 1 })).toHaveLength(1);
    expect(activeTasks(tasks, { year: 2026, month: 6, day: 30 })).toHaveLength(1);
    expect(activeTasks(tasks, { year: 2026, month: 4, day: 30 })).toHaveLength(0);
    expect(activeTasks(tasks, { year: 2026, month: 7, day: 1 })).toHaveLength(0);
  });

  it('해를 넘기는 작업도 센다: 철사걸이 11~2월', () => {
    const wiring = [task({ taskCode: 'wiring', monthStart: 11, monthEnd: 2 })];

    for (const month of [11, 12, 1, 2]) {
      expect(activeTasks(wiring, { year: 2026, month, day: 15 })).toHaveLength(1);
    }
    expect(activeTasks(wiring, { year: 2026, month: 3, day: 1 })).toHaveLength(0);
  });

  it('올해 이미 마친 작업은 빼고, 해가 바뀌면 다시 보여 준다 (매년 리셋)', () => {
    const done = [task({ doneYear: 2026 })];

    expect(activeTasks(done, { year: 2026, month: 5, day: 10 })).toHaveLength(0);
    expect(activeTasks(done, { year: 2027, month: 5, day: 10 })).toHaveLength(1);
  });
});

describe('upcomingTaskMonth: 다음 작업이 몇 월인가 (SPEC.md 3.4)', () => {
  it('이번 달 뒤로 가장 가까운 시작 월', () => {
    const tasks = [
      task({ taskCode: 'repot', monthStart: 3, monthEnd: 3 }),
      task({ taskCode: 'pinch_candles', monthStart: 5, monthEnd: 6 }),
    ];

    expect(upcomingTaskMonth(tasks, 4)).toMatchObject({ taskCode: 'pinch_candles', month: 5 });
  });

  it('올해 남은 것이 없으면 내년 첫 작업으로 넘어간다', () => {
    const tasks = [task({ taskCode: 'repot', monthStart: 3, monthEnd: 3 })];

    expect(upcomingTaskMonth(tasks, 9)).toMatchObject({ taskCode: 'repot', month: 3 });
  });

  it('작업이 없으면 null', () => {
    expect(upcomingTaskMonth([], 5)).toBeNull();
  });
});

describe('taskRowsFor: 종 DB 의 작업을 식물의 캘린더로 옮긴다 (SPEC.md 6.2)', () => {
  it('분재일 때만 만든다', () => {
    const source = [
      { task_code: 'pinch_candles', month_start: 5, month_end: 6, label_ko: '순따기' },
    ];

    expect(taskRowsFor('plant-1', source, true, () => 'id-1')).toEqual([
      {
        id: 'id-1',
        plantId: 'plant-1',
        taskCode: 'pinch_candles',
        monthStart: 5,
        monthEnd: 6,
        labelKo: '순따기',
      },
    ]);
    expect(taskRowsFor('plant-1', source, false, () => 'id-1')).toEqual([]);
  });

  it('모양이 다른 항목은 건너뛴다. 서버가 만든 값이라 믿지 않는다', () => {
    const source = [
      { task_code: 'ok', month_start: 3, month_end: 4, label_ko: '괜찮음' },
      { task_code: '', month_start: 3, month_end: 4, label_ko: '이름 없음' },
      { task_code: 'bad', month_start: 0, month_end: 4, label_ko: '없는 달' },
      { task_code: 'bad', month_start: 3, month_end: 13, label_ko: '없는 달' },
      'not an object',
    ];

    expect(taskRowsFor('plant-1', source, true, () => 'id')).toHaveLength(1);
  });

  it('작업이 없거나 배열이 아니면 빈 배열', () => {
    expect(taskRowsFor('plant-1', null, true, () => 'id')).toEqual([]);
    expect(taskRowsFor('plant-1', [], true, () => 'id')).toEqual([]);
  });
});

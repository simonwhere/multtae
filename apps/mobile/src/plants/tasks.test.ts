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

  it('이번 달에 시작하는 것은 이미 할 일에 나오므로 뒤로 민다', () => {
    const tasks = [
      task({ taskCode: 'pull_old_needles', monthStart: 9, monthEnd: 10 }),
      task({ taskCode: 'wiring', monthStart: 10, monthEnd: 2 }),
    ];

    expect(upcomingTaskMonth(tasks, 9)).toMatchObject({ taskCode: 'wiring', month: 10 });
  });
});

describe('taskRowsFor: 수종군 기준표를 식물의 캘린더로 옮긴다 (SPEC.md 6.2, 10-1)', () => {
  const ids = () => {
    let n = 0;
    return () => `id-${(n += 1)}`;
  };

  it('소나무류는 순따기·묵은 잎 뽑기·철사걸이·분갈이다', () => {
    const rows = taskRowsFor(
      'plant-1',
      { isBonsai: true, bonsaiGroup: 'conifer', scientificName: 'Pinus thunbergii' },
      ids(),
    );

    expect(rows.map((row) => row.taskCode)).toEqual(['pinch_candles', 'pull_old_needles', 'wiring', 'repot']);
    expect(rows[0]).toEqual({
      id: 'id-1',
      plantId: 'plant-1',
      taskCode: 'pinch_candles',
      monthStart: 5,
      monthEnd: 6,
      labelKo: '순따기',
    });
    // 철사걸이는 해를 넘긴다
    expect(rows[2]).toMatchObject({ monthStart: 11, monthEnd: 2 });
  });

  it('향나무·진백 같은 다른 침엽은 순집기와 분갈이다. 종을 모르면 이쪽이다', () => {
    const juniper = taskRowsFor('p', { isBonsai: true, bonsaiGroup: 'conifer', scientificName: 'Juniperus chinensis' }, ids());
    const unknown = taskRowsFor('p', { isBonsai: true, bonsaiGroup: 'conifer', scientificName: null }, ids());

    expect(juniper.map((row) => row.taskCode)).toEqual(['pinch_tips', 'repot']);
    expect(unknown.map((row) => row.taskCode)).toEqual(['pinch_tips', 'repot']);
  });

  it('잡목과 화목은 작업이 다르다', () => {
    const maple = taskRowsFor('p', { isBonsai: true, bonsaiGroup: 'deciduous', scientificName: 'Acer palmatum' }, ids());
    const quince = taskRowsFor('p', { isBonsai: true, bonsaiGroup: 'flowering', scientificName: 'Chaenomeles japonica' }, ids());

    expect(maple.map((row) => row.labelKo)).toEqual(['분갈이', '잎자르기', '가지치기']);
    expect(quince.map((row) => row.labelKo)).toEqual(['꽃 후 전정', '분갈이']);
  });

  it('분재가 아니거나 수종군이 없으면 만들지 않는다', () => {
    expect(taskRowsFor('p', { isBonsai: false, bonsaiGroup: 'conifer', scientificName: 'Pinus thunbergii' }, ids())).toEqual([]);
    expect(taskRowsFor('p', { isBonsai: true, bonsaiGroup: null, scientificName: null }, ids())).toEqual([]);
  });
});

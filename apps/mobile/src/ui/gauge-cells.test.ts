import { describe, expect, it } from 'vitest';

import { gaugeCells, MAX_GAUGE_CELLS } from './gauge-cells';

describe('gaugeCells: 하루가 한 칸인 물주기 게이지 (SPEC.md 14.1)', () => {
  it('칸 수는 주기의 일수이고, 남은 날만큼 차 있다', () => {
    expect(gaugeCells({ status: 'moist', moisture: 1, totalDays: 7 })).toEqual({ cells: 7, filled: 7 });
    expect(gaugeCells({ status: 'moist', moisture: 4 / 7, totalDays: 7 })).toEqual({ cells: 7, filled: 4 });
    expect(gaugeCells({ status: 'moist', moisture: 1 / 7, totalDays: 7 })).toEqual({ cells: 7, filled: 1 });
  });

  it('물 줄 날과 밀린 날은 전부 비어 있다', () => {
    expect(gaugeCells({ status: 'due', moisture: 0, totalDays: 7 })).toEqual({ cells: 7, filled: 0 });
    expect(gaugeCells({ status: 'overdue', moisture: 0, totalDays: 9 })).toEqual({ cells: 9, filled: 0 });
  });

  it(`긴 주기는 ${MAX_GAUGE_CELLS}칸으로 줄여 비율로 채운다`, () => {
    expect(gaugeCells({ status: 'moist', moisture: 20 / 35, totalDays: 35 })).toEqual({
      cells: MAX_GAUGE_CELLS,
      filled: 8,
    });
  });

  it('아직 물 줄 날이 아니면 조금 남았어도 한 칸은 차 있다', () => {
    expect(gaugeCells({ status: 'moist', moisture: 1 / 35, totalDays: 35 })).toEqual({
      cells: MAX_GAUGE_CELLS,
      filled: 1,
    });
  });

  it('하루 주기는 한 칸이다', () => {
    expect(gaugeCells({ status: 'moist', moisture: 1, totalDays: 1 })).toEqual({ cells: 1, filled: 1 });
    expect(gaugeCells({ status: 'due', moisture: 0, totalDays: 0 })).toEqual({ cells: 1, filled: 0 });
  });
});

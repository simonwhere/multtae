/**
 * 물주기 게이지의 칸 (SPEC.md 14.1): 하루가 한 칸이고, 다음 물주기까지 남은 날만큼 왼쪽부터 차 있다.
 * 화면과 무관한 순수 함수라 Node 에서 테스트한다.
 */
import type { SoilGaugeState } from '../engine/soil';

/** 칸이 너무 잘아지지 않게 하는 상한. 주기가 이보다 길면 비율로 채운다 */
export const MAX_GAUGE_CELLS = 14;

export function gaugeCells({
  status,
  moisture,
  totalDays,
}: Pick<SoilGaugeState, 'status' | 'moisture' | 'totalDays'>): { cells: number; filled: number } {
  const cells = Math.min(Math.max(Math.round(totalDays), 1), MAX_GAUGE_CELLS);
  if (status !== 'moist') return { cells, filled: 0 };

  // 아직 물 줄 날이 아니면 조금 남았어도 한 칸은 보인다
  return { cells, filled: Math.min(cells, Math.max(1, Math.round(moisture * cells))) };
}

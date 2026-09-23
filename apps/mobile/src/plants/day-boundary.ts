/**
 * 날이 바뀌는 자리 (SPEC.md 12.2, 15 시간). 화면과 시계가 어긋나지 않게 쓰는 순수 함수다.
 * 화면에 붙이는 일은 use-fresh-day.ts 가 맡는다.
 */
const DAY = 24 * 60 * 60 * 1000;

/**
 * 다음 자정(기기 시간대)까지 남은 밀리초.
 * 자정 정각이면 하루를 통째로 돌려준다. 0 을 돌려주면 타이머가 곧바로 되풀이된다.
 */
export function msUntilNextDay(now: number, utcOffsetMinutes: number): number {
  const local = now + utcOffsetMinutes * 60_000;
  const passed = ((local % DAY) + DAY) % DAY;
  return DAY - passed;
}

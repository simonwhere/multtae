import { describe, expect, it } from 'vitest';

import type { WateringLog } from '../db/schema';
import type { CalendarDate } from '../engine';
import {
  fertilizerRule,
  isFertilizerDue,
  monthsBetween,
  repotHint,
  ROOTS_DRY,
  ROOTS_WINDOW,
} from './feeding';

const date = (year: number, month: number, day: number): CalendarDate => ({ year, month, day });
const noHistory = { lastFertilized: null, lastRepot: null };

describe('fertilizerRule: 종 DB 가 먼저, 없으면 식물군 기본값 (SPEC.md 8.2)', () => {
  it('식물군 기본값', () => {
    expect(fertilizerRule({ groupCode: 'tropical' }, null)).toEqual({
      months: [4, 5, 6, 7, 8, 9, 10],
      intervalDays: 28,
    });
    expect(fertilizerRule({ groupCode: 'succulent' }, null)).toEqual({
      months: [4, 5, 6, 9, 10],
      intervalDays: 56,
    });
    expect(fertilizerRule({ groupCode: 'herb' }, null).intervalDays).toBe(14);
    expect(fertilizerRule({ groupCode: 'bonsai_conifer' }, null).months).toEqual([4, 5, 6, 9, 10]);
  });

  it('종 DB 규칙이 있으면 그것을 쓰고, 모양이 틀리면 기본값', () => {
    const species = { fertilizer: { months: [5, 6, 13], interval_weeks: 3, note: null } };

    expect(fertilizerRule({ groupCode: 'tropical' }, species)).toEqual({ months: [5, 6], intervalDays: 21 });
    expect(fertilizerRule({ groupCode: 'tropical' }, { fertilizer: { months: [], interval_weeks: 3 } }).intervalDays).toBe(28);
    expect(fertilizerRule({ groupCode: 'tropical' }, { fertilizer: { months: [5], interval_weeks: null } }).intervalDays).toBe(28);
    expect(fertilizerRule({ groupCode: 'tropical' }, { fertilizer: null }).intervalDays).toBe(28);
  });
});

describe('isFertilizerDue (SPEC.md 8.2)', () => {
  const rule = fertilizerRule({ groupCode: 'tropical' }, null);

  it('비료 주는 달이고 한 번도 안 줬으면 준다', () => {
    expect(isFertilizerDue(rule, noHistory, date(2026, 5, 10), 'spring')).toBe(true);
  });

  it('간격이 차야 다시 준다', () => {
    const history = { lastFertilized: date(2026, 5, 1), lastRepot: null };

    expect(isFertilizerDue(rule, history, date(2026, 5, 28), 'spring')).toBe(false);
    expect(isFertilizerDue(rule, history, date(2026, 5, 29), 'spring')).toBe(true);
  });

  it('비료 주는 달이 아니거나 장마·폭염·겨울이면 쉰다', () => {
    expect(isFertilizerDue(rule, noHistory, date(2026, 3, 10), 'spring')).toBe(false);
    expect(isFertilizerDue(rule, noHistory, date(2026, 7, 1), 'monsoon')).toBe(false);
    expect(isFertilizerDue(rule, noHistory, date(2026, 8, 1), 'heat')).toBe(false);
    expect(isFertilizerDue(rule, noHistory, date(2026, 9, 10), 'autumn')).toBe(true);
  });

  it('분갈이 뒤 4주는 쉰다', () => {
    const history = { lastFertilized: null, lastRepot: date(2026, 5, 1) };

    expect(isFertilizerDue(rule, history, date(2026, 5, 28), 'spring')).toBe(false);
    expect(isFertilizerDue(rule, history, date(2026, 5, 29), 'spring')).toBe(true);
  });
});

describe('monthsBetween', () => {
  it('온전한 달 수', () => {
    expect(monthsBetween(date(2025, 3, 15), date(2026, 9, 14))).toBe(17);
    expect(monthsBetween(date(2025, 3, 15), date(2026, 9, 15))).toBe(18);
    expect(monthsBetween(date(2026, 1, 1), date(2026, 1, 31))).toBe(0);
  });
});

describe('repotHint: 분갈이 검토 (SPEC.md 8.3)', () => {
  const tropical = { groupCode: 'tropical' as const, isBonsai: false, soilType: 'potting' as const };
  const quiet = { recent: [] };

  it('권장 주기가 지났고 적기(3~4월)면 알린다', () => {
    const history = { since: date(2024, 9, 1), known: true, ...quiet };

    expect(repotHint(tropical, null, history, date(2026, 3, 1))).toEqual({
      reason: 'interval',
      months: 18,
      known: true,
      season: [3, 4],
    });
    // 적기가 아니면 아직
    expect(repotHint(tropical, null, history, date(2026, 5, 1))).toBeNull();
  });

  it('권장 주기가 안 됐으면 적기여도 아직', () => {
    expect(repotHint(tropical, null, { since: date(2025, 9, 1), known: true, ...quiet }, date(2026, 4, 1))).toBeNull();
  });

  it('종 DB 의 주기와 적기를 먼저 쓴다', () => {
    const species = { repotMonths: 12, repotSeason: [5, 6] };
    const history = { since: date(2025, 5, 1), known: false, ...quiet };

    expect(repotHint(tropical, species, history, date(2026, 5, 1))).toMatchObject({
      reason: 'interval',
      months: 12,
      known: false,
    });
    expect(repotHint(tropical, species, history, date(2026, 4, 1))).toBeNull();
  });

  it('바싹 말랐음이 최근 5번 중 4번 이상이면 뿌리가 찼을 수 있다. 주기와 무관하다', () => {
    type Log = Pick<WateringLog, 'soilState' | 'source'>;
    const dry: Log = { soilState: 'dry', source: 'user' };
    const ok: Log = { soilState: 'ok', source: 'user' };
    const history = (recent: Log[]) => ({ since: date(2026, 6, 1), known: true, recent });

    expect(ROOTS_WINDOW).toBe(5);
    expect(ROOTS_DRY).toBe(4);
    expect(repotHint(tropical, null, history([dry, dry, ok, dry, dry]), date(2026, 9, 1))).toEqual({
      reason: 'roots',
    });
    expect(repotHint(tropical, null, history([dry, ok, ok, dry, dry]), date(2026, 9, 1))).toBeNull();
    // 기록이 다섯 번이 안 되면 아직 모른다
    expect(repotHint(tropical, null, history([dry, dry, dry, dry]), date(2026, 9, 1))).toBeNull();
  });

  it('흙 상태를 고르지 않았거나 비가 준 기록은 세지 않는다', () => {
    const dry = { soilState: 'dry' as const, source: 'user' as const };
    const skipped = { soilState: 'skipped' as const, source: 'user' as const };
    const rain = { soilState: 'skipped' as const, source: 'rain' as const };

    expect(
      repotHint(tropical, null, { since: date(2026, 6, 1), known: true, recent: [skipped, rain, dry, dry, dry, dry, skipped] }, date(2026, 9, 1)),
    ).toBeNull();
  });

  it('분재와 수경은 이 규칙을 쓰지 않는다', () => {
    const history = { since: date(2020, 1, 1), known: true, recent: [] };

    expect(repotHint({ ...tropical, isBonsai: true }, null, history, date(2026, 3, 1))).toBeNull();
    expect(repotHint({ ...tropical, soilType: 'hydro' }, null, history, date(2026, 3, 1))).toBeNull();
  });
});

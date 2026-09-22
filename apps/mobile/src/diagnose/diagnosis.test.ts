import { describe, expect, it } from 'vitest';

import { likelihoodOf, parseDiagnosis } from './diagnosis';

const server = {
  findings: [
    { name: '과습', confidence: 0.6 },
    { name: '응애', confidence: 0.3 },
  ],
  cause: '흙이 계속 젖어 있어요',
  actions: ['물을 멈춰 주세요', '뿌리를 봐 주세요', '바람이 통하는 곳으로 옮겨 주세요'],
  watering_hint: 'over',
  recheck_days: 5,
  severity: 'medium',
};

const parsed = {
  findings: server.findings,
  cause: server.cause,
  actions: server.actions,
  wateringHint: 'over',
  recheckDays: 5,
  severity: 'medium',
  recheckDate: null,
  hintAnswer: null,
};

describe('parseDiagnosis (SPEC.md 9.3)', () => {
  it('서버 응답과 저장한 값을 같게 읽는다', () => {
    expect(parseDiagnosis(server)).toEqual(parsed);
    expect(parseDiagnosis(parsed)).toEqual(parsed);
    expect(parseDiagnosis(JSON.parse(JSON.stringify(parsed)))).toEqual(parsed);
  });

  it('모양이 틀리면 null, 깨진 진단명과 할 일은 버린다', () => {
    expect(parseDiagnosis(null)).toBeNull();
    expect(parseDiagnosis({ ...server, severity: 'extreme' })).toBeNull();
    expect(parseDiagnosis({ ...server, recheck_days: 0 })).toBeNull();
    expect(parseDiagnosis({ ...server, findings: 'many' })).toBeNull();
    expect(
      parseDiagnosis({ ...server, findings: [{ name: '과습', confidence: 2 }, { name: '응애', confidence: 0.2 }], actions: ['물을 멈춰 주세요', 3] }),
    ).toMatchObject({ findings: [{ name: '응애', confidence: 0.2 }], actions: ['물을 멈춰 주세요'] });
  });
});

describe('likelihoodOf: 확신도를 말로', () => {
  it('0.6 이상 높음, 0.3 이상 있음, 그 아래 낮음', () => {
    expect(likelihoodOf(0.6)).toBe('high');
    expect(likelihoodOf(0.59)).toBe('medium');
    expect(likelihoodOf(0.3)).toBe('medium');
    expect(likelihoodOf(0.29)).toBe('low');
  });
});

describe('저장해 둔 답 (SPEC.md 8.1)', () => {
  it('다시 볼 날과 물주기 판단에 답한 것을 읽는다', () => {
    expect(parseDiagnosis({ ...parsed, recheckDate: '2026-09-29', hintAnswer: 'applied' })).toMatchObject({
      recheckDate: '2026-09-29',
      hintAnswer: 'applied',
    });
  });

  it('모양이 틀리면 없는 것으로 본다', () => {
    expect(parseDiagnosis({ ...parsed, recheckDate: '9/29', hintAnswer: 'maybe' })).toMatchObject({
      recheckDate: null,
      hintAnswer: null,
    });
  });
});

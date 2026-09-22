import { describe, expect, it } from 'vitest';

import {
  buildDiagnosePrompt,
  hashDeviceId,
  isDeviceId,
  tidy,
  parseRecent,
  SYSTEM_PROMPT,
  validateDiagnosis,
  validateDiagnosisLoosely,
} from './diagnose';

const good = {
  findings: [
    { name: '응애', confidence: 0.3 },
    { name: '과습', confidence: 0.6 },
    { name: '잎 끝 마름', confidence: 0.1 },
  ],
  cause: '잎 아래쪽부터 노랗게 변하고 흙이 계속 젖어 있어요',
  actions: [
    '흙이 완전히 마를 때까지 물을 멈춰 주세요',
    '화분을 빼서 뿌리를 봐 주세요',
    '바람이 잘 통하는 곳으로 옮겨 주세요',
    '잎을 닦아 주세요',
  ],
  watering_hint: 'over',
  recheck_days: 5,
  severity: 'medium',
};

describe('validateDiagnosis (SPEC.md 9.3)', () => {
  it('진단명은 확신이 높은 것부터 두 개, 할 일은 세 개까지', () => {
    expect(validateDiagnosis(good)).toEqual({
      ok: true,
      value: {
        ...good,
        findings: [
          { name: '과습', confidence: 0.6 },
          { name: '응애', confidence: 0.3 },
        ],
        actions: good.actions.slice(0, 3),
      },
    });
  });

  it('뚜렷한 문제가 없으면 진단명은 비어도 된다', () => {
    expect(validateDiagnosis({ ...good, findings: [], severity: 'low' }).ok).toBe(true);
  });

  it('모양이 틀리면 이유와 함께 거부한다', () => {
    expect(validateDiagnosis({ ...good, watering_hint: 'more' })).toMatchObject({ ok: false });
    expect(validateDiagnosis({ ...good, recheck_days: 0 })).toMatchObject({ ok: false });
    expect(validateDiagnosis({ ...good, actions: [] })).toMatchObject({ ok: false });
    expect(validateDiagnosis(null)).toMatchObject({ ok: false });
  });

  it('원인이나 할 일이 존댓말이 아니면 거부한다 (CLAUDE.md 문구 규칙)', () => {
    const result = validateDiagnosis({ ...good, actions: ['물 중단', ...good.actions.slice(1)] });

    expect(result).toEqual({ ok: false, reason: '"물 중단" 가 존댓말(…요)로 끝나지 않습니다.' });
  });

  it('두 번째에는 문구 규칙만 어긴 답을 받아 준다. 모양이 틀린 답은 받지 않는다', () => {
    expect(validateDiagnosisLoosely({ ...good, cause: '흙이 젖어 있음' })?.cause).toBe('흙이 젖어 있음');
    expect(validateDiagnosisLoosely({ ...good, severity: 'extreme' })).toBeNull();
  });
});

describe('프롬프트 (SPEC.md 9.3)', () => {
  it('종, 식물군, 최근 물주기를 적는다', () => {
    const prompt = buildDiagnosePrompt({
      species: '몬스테라',
      groupCode: 'tropical',
      recent: [
        { date: '2026-09-20', soilState: 'wet', leafDroop: true },
        { date: '2026-09-13', soilState: 'ok', leafDroop: false },
      ],
    });

    expect(prompt).toContain('종: 몬스테라');
    expect(prompt).toContain('식물군: tropical');
    expect(prompt).toContain('- 2026-09-20: 흙 아직 축축했음, 잎이 처짐');
    expect(prompt).not.toContain('거부');
  });

  it('모르는 종과 기록 없음, 거부 이유', () => {
    const prompt = buildDiagnosePrompt({ species: null, groupCode: 'herb', recent: [] }, '형식');

    expect(prompt).toContain('종: 모름');
    expect(prompt).toContain('기록 없음');
    expect(prompt).toContain('이유: 형식');
  });

  it('시스템 프롬프트는 확신 없음과 가정용 조치, 성분 계열만을 말한다', () => {
    expect(SYSTEM_PROMPT).toContain('확신 없는 것은 확신 없다고');
    expect(SYSTEM_PROMPT).toContain('성분 계열만');
  });
});

describe('앱이 보낸 값', () => {
  it('최근 물주기는 모양이 맞는 것만 다섯 건까지', () => {
    const recent = JSON.stringify([
      { date: '2026-09-20T03:00:00Z', soilState: 'wet', leafDroop: false },
      { date: 7 },
      ...Array.from({ length: 6 }, () => ({ date: '2026-09-01', soilState: 'ok', leafDroop: false })),
    ]);

    expect(parseRecent(recent)).toHaveLength(5);
    expect(parseRecent(recent)[0]).toEqual({ date: '2026-09-20', soilState: 'wet', leafDroop: false });
    expect(parseRecent('{broken')).toEqual([]);
    expect(parseRecent(null)).toEqual([]);
  });

  it('기기 id 는 uuid 만 받고 해시로 센다 (SPEC.md 11.3)', async () => {
    const id = '3F2504E0-4F89-11D3-9A0C-0305E82C3301';

    expect(isDeviceId(id)).toBe(true);
    expect(isDeviceId('not-a-uuid')).toBe(false);
    const hash = await hashDeviceId(id);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toBe(await hashDeviceId(id.toLowerCase()));
    expect(hash).not.toContain('3f2504e0');
  });
});

describe('tidy: 대시 문장부호를 쓰지 않는다 (CLAUDE.md)', () => {
  it('숫자 범위는 물결표로, 문장 사이 긴 대시는 쉼표로', () => {
    expect(tidy('흙 속 2-3cm 깊이까지 봐 주세요')).toBe('흙 속 2~3cm 깊이까지 봐 주세요');
    expect(tidy('5 – 7일 뒤에')).toBe('5~7일 뒤에');
    expect(tidy('잎이 처졌어요 — 물을 주세요')).toBe('잎이 처졌어요, 물을 주세요');
  });

  it('진단 결과에 적용된다', () => {
    const result = validateDiagnosis({ ...good, actions: ['흙 속 2-3cm 까지 확인해 주세요'] });

    expect(result.ok && result.value.actions).toEqual(['흙 속 2~3cm 까지 확인해 주세요']);
  });
});

import { describe, expect, it } from 'vitest';

import {
  bytesToBase64,
  buildLightPrompt,
  isDirection,
  isPolite,
  isSpaceType,
  MAX_EVIDENCE,
  SYSTEM_PROMPT,
  validateLightReading,
} from './light';

const reading = (overrides: Record<string, unknown> = {}) => ({
  grade: 'medium',
  confidence: 0.78,
  evidence: ['창이 사진 왼쪽에 크게 보임', '얇은 커튼이 반쯤 쳐짐'],
  window_visible: true,
  curtain: 'sheer',
  distance_m: 1.0,
  note_ko: '동향이라 오전에만 직사광이 들어요',
  ...overrides,
});

describe('validateLightReading (SPEC.md 9.2 출력 JSON)', () => {
  it('명세의 응답을 그대로 읽는다', () => {
    expect(validateLightReading(reading())).toEqual(reading());
  });

  it('빠진 값은 비워 둔다. 등급과 확신도만 있으면 쓸 수 있다', () => {
    expect(validateLightReading({ grade: 'high', confidence: 0.9 })).toEqual({
      grade: 'high',
      confidence: 0.9,
      evidence: [],
      window_visible: null,
      curtain: null,
      distance_m: null,
      note_ko: null,
    });
  });

  it('등급이나 확신도가 없거나 범위를 벗어나면 버린다', () => {
    expect(validateLightReading(null)).toBeNull();
    expect(validateLightReading(reading({ grade: 'bright' }))).toBeNull();
    expect(validateLightReading(reading({ grade: null }))).toBeNull();
    expect(validateLightReading(reading({ confidence: 1.4 }))).toBeNull();
    expect(validateLightReading(reading({ confidence: '0.8' }))).toBeNull();
  });

  it('근거는 앞에서 세 문장까지만 남긴다', () => {
    const many = ['하나', '둘', '셋', '넷', '다섯'];
    expect(MAX_EVIDENCE).toBe(3);
    expect(validateLightReading(reading({ evidence: many }))?.evidence).toEqual(['하나', '둘', '셋']);
  });

  it('근거의 빈 문장은 버리고 앞뒤 공백은 턴다', () => {
    expect(validateLightReading(reading({ evidence: ['  창이 보임  ', '', '   ', 7] }))?.evidence).toEqual([
      '창이 보임',
    ]);
  });

  it('존댓말이 아닌 한 줄 설명은 버린다 (CLAUDE.md 문구 규칙)', () => {
    expect(isPolite('한낮에는 잎이 타지 않는지 살펴 주세요')).toBe(true);
    expect(isPolite('오전에만 직사광이 들어요.')).toBe(true);
    expect(isPolite('직사광이 강하니 주의해야 합니다')).toBe(true);
    expect(isPolite('잎이 타지 않도록 살펴보는 것이 좋다')).toBe(false);

    expect(
      validateLightReading(reading({ note_ko: '잎이 타지 않도록 살펴보는 것이 좋다' }))?.note_ko,
    ).toBeNull();
    expect(validateLightReading(reading())?.note_ko).toBe('동향이라 오전에만 직사광이 들어요');
  });

  it('커튼·거리·창 보임은 모르면 비워 둔다', () => {
    const value = validateLightReading(
      reading({ curtain: 'thick', distance_m: -1, window_visible: 'yes', note_ko: '  ' }),
    );

    expect(value).toMatchObject({
      grade: 'medium',
      curtain: null,
      distance_m: null,
      window_visible: null,
      note_ko: null,
    });
  });
});

describe('buildLightPrompt (SPEC.md 9.2)', () => {
  it('방향과 유형을 적는다', () => {
    const prompt = buildLightPrompt('E', 'indoor_window');

    expect(prompt).toContain('direction: E');
    expect(prompt).toContain('space_type: indoor_window');
  });

  it('방향을 모르면 모른다고 적는다', () => {
    expect(buildLightPrompt('unknown', 'terrace')).toContain('direction: unknown');
  });

  it('시스템 프롬프트에 네 등급의 기준이 모두 있다', () => {
    for (const grade of ['high', 'medium', 'low', 'very_low']) {
      expect(SYSTEM_PROMPT).toContain(grade);
    }
  });
});

describe('isDirection, isSpaceType: 앱이 보낸 값을 확인한다', () => {
  it('아는 값만 받는다', () => {
    expect(isDirection('S')).toBe(true);
    expect(isDirection('unknown')).toBe(true);
    expect(isDirection('남')).toBe(false);
    expect(isSpaceType('balcony_ext')).toBe(true);
    expect(isSpaceType('balcony')).toBe(false);
  });
});

describe('bytesToBase64: 사진을 Claude 가 받는 형식으로', () => {
  it('짧은 바이트열을 옮긴다', () => {
    expect(bytesToBase64(new Uint8Array([104, 105]))).toBe('aGk=');
    expect(bytesToBase64(new Uint8Array())).toBe('');
  });

  it('사진 크기에서도 한 번에 옮긴다', () => {
    const bytes = Uint8Array.from({ length: 300_000 }, (_, index) => index % 256);

    expect(bytesToBase64(bytes)).toBe(Buffer.from(bytes).toString('base64'));
  });
});

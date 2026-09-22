import { describe, expect, it } from 'vitest';

import { parseLightReading, SHOWN_EVIDENCE, shownEvidence } from './light-reading';

const server = {
  grade: 'medium',
  confidence: 0.78,
  evidence: ['창이 사진 왼쪽에 크게 보임', '얇은 커튼이 반쯤 쳐짐', '식물 자리는 창에서 약 1m'],
  window_visible: true,
  curtain: 'sheer',
  distance_m: 1.0,
  note_ko: '동향이라 오전에만 직사광이 들어요',
};

const parsed = {
  grade: 'medium',
  confidence: 0.78,
  evidence: ['창이 사진 왼쪽에 크게 보임', '얇은 커튼이 반쯤 쳐짐', '식물 자리는 창에서 약 1m'],
  windowVisible: true,
  curtain: 'sheer',
  distanceM: 1.0,
  noteKo: '동향이라 오전에만 직사광이 들어요',
};

describe('parseLightReading (SPEC.md 9.2)', () => {
  it('서버 응답을 읽는다', () => {
    expect(parseLightReading(server)).toEqual(parsed);
  });

  it('저장해 둔 값을 다시 읽는다', () => {
    expect(parseLightReading(parsed)).toEqual(parsed);
    expect(parseLightReading(JSON.parse(JSON.stringify(parsed)))).toEqual(parsed);
  });

  it('등급과 확신도가 없거나 이상하면 null 이다. 그러면 기본값 표로 간다', () => {
    expect(parseLightReading(null)).toBeNull();
    expect(parseLightReading('medium')).toBeNull();
    expect(parseLightReading([])).toBeNull();
    expect(parseLightReading({ ...server, grade: 'bright' })).toBeNull();
    expect(parseLightReading({ ...server, confidence: 1.2 })).toBeNull();
    expect(parseLightReading({ ...server, confidence: null })).toBeNull();
  });

  it('나머지 값은 없거나 이상하면 비워 둔다', () => {
    expect(
      parseLightReading({
        grade: 'low',
        confidence: 0.4,
        evidence: 'many',
        curtain: 'thick',
        distance_m: -2,
        window_visible: 'yes',
        note_ko: '   ',
      }),
    ).toEqual({
      grade: 'low',
      confidence: 0.4,
      evidence: [],
      windowVisible: null,
      curtain: null,
      distanceM: null,
      noteKo: null,
    });
  });

  it('근거의 빈 문장은 버리고 앞뒤 공백은 턴다', () => {
    expect(parseLightReading({ ...server, evidence: ['  창이 보임 ', '', 3] })?.evidence).toEqual([
      '창이 보임',
    ]);
  });
});

describe('shownEvidence: 화면에는 두 줄까지 (SPEC.md 4.1)', () => {
  it('앞에서 두 줄만 보여 준다', () => {
    expect(SHOWN_EVIDENCE).toBe(2);
    expect(shownEvidence(parseLightReading(server))).toEqual([
      '창이 사진 왼쪽에 크게 보임',
      '얇은 커튼이 반쯤 쳐짐',
    ]);
  });

  it('판단이 없으면 빈 배열', () => {
    expect(shownEvidence(null)).toEqual([]);
  });
});

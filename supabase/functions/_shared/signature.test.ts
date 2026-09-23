import { describe, expect, it } from 'vitest';

import { sign, signaturePayload, SIGNATURE_SKEW_MS, verifySignature } from './signature.ts';

const SECRET = 'test-secret';
const NOW = 1_790_000_000_000;

const header = async (timestamp: number, functionName: string, secret = SECRET) =>
  `${timestamp}.${await sign(secret, timestamp, functionName)}`;

describe('앱 서명 헤더 (SPEC.md 9, 13.3)', () => {
  it('서명 대상은 타임스탬프와 함수 이름이다', () => {
    expect(signaturePayload(NOW, 'identify')).toBe('1790000000000.identify');
  });

  it('제대로 만든 헤더는 통과한다', async () => {
    expect(await verifySignature(await header(NOW, 'identify'), SECRET, 'identify', NOW)).toBe('ok');
  });

  it('다른 함수의 서명은 통과하지 못한다', async () => {
    expect(await verifySignature(await header(NOW, 'diagnose'), SECRET, 'identify', NOW)).toBe(
      'mismatch',
    );
  });

  it('다른 시크릿으로 만든 서명도 통과하지 못한다', async () => {
    const other = await header(NOW, 'identify', 'another-secret');

    expect(await verifySignature(other, SECRET, 'identify', NOW)).toBe('mismatch');
  });

  it('시계가 조금 틀려도 되지만 너무 오래된 것은 받지 않는다', async () => {
    const made = await header(NOW, 'identify');

    expect(await verifySignature(made, SECRET, 'identify', NOW + SIGNATURE_SKEW_MS - 1)).toBe('ok');
    expect(await verifySignature(made, SECRET, 'identify', NOW + SIGNATURE_SKEW_MS + 1)).toBe(
      'expired',
    );
    // 앞선 시각도 같게 본다
    expect(await verifySignature(made, SECRET, 'identify', NOW - SIGNATURE_SKEW_MS + 1)).toBe('ok');
  });

  it('없거나 모양이 틀린 헤더', async () => {
    expect(await verifySignature(null, SECRET, 'identify', NOW)).toBe('missing');
    expect(await verifySignature('', SECRET, 'identify', NOW)).toBe('missing');
    expect(await verifySignature('없음', SECRET, 'identify', NOW)).toBe('malformed');
    expect(await verifySignature(`${NOW}.`, SECRET, 'identify', NOW)).toBe('malformed');
  });

  it('시크릿을 아직 넣지 않았으면 확인하지 않는다', async () => {
    expect(await verifySignature(null, '', 'identify', NOW)).toBe('ok');
  });
});

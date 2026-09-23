import { createHash, createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { hmacSha256, signatureHeader, signaturePayload } from './signature';

/** 기기에서는 expo-crypto 가 한다. 테스트에서는 Node 로 */
const sha256 = async (data: Uint8Array) => new Uint8Array(createHash('sha256').update(data).digest());

const NOW = 1_790_000_000_000;

describe('앱 서명 (SPEC.md 9, 13.3)', () => {
  it('HMAC 은 표준 구현과 같은 값을 낸다', async () => {
    for (const [secret, message] of [
      ['secret', 'hello'],
      ['', 'hello'],
      // 블록(64바이트)보다 긴 시크릿은 먼저 해시한다
      ['x'.repeat(100), '1790000000000.identify'],
      ['시크릿', '한글도'],
    ]) {
      expect(await hmacSha256(sha256, secret, message)).toBe(
        createHmac('sha256', secret).update(message).digest('hex'),
      );
    }
  });

  it('서명 대상은 타임스탬프와 함수 이름이다', () => {
    expect(signaturePayload(NOW, 'identify')).toBe('1790000000000.identify');
  });

  it('헤더는 타임스탬프와 서명을 점으로 잇는다', async () => {
    const header = await signatureHeader(sha256, 'secret', 'identify', NOW);

    expect(header).toBe(
      `${NOW}.${createHmac('sha256', 'secret').update(`${NOW}.identify`).digest('hex')}`,
    );
  });

  it('시크릿이 없으면 헤더를 붙이지 않는다', async () => {
    expect(await signatureHeader(sha256, '', 'identify', NOW)).toBeNull();
  });
});

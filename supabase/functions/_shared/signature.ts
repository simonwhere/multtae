/**
 * 앱 서명 헤더 (SPEC.md 9, 13.3). 빌드할 때 넣은 정적 시크릿과 타임스탬프로 만든 HMAC 이다.
 * 앱 번들을 뜯으면 시크릿도 보이므로 완벽한 방어는 아니고, 무작위 호출을 막는 문턱이다.
 * 남용이 보이면 시크릿을 바꿔 새로 배포한다.
 *
 * 헤더 모양: `x-app-signature: <밀리초 타임스탬프>.<hex HMAC-SHA256>`
 * 서명 대상은 `<타임스탬프>.<함수 이름>` 이라 다른 함수의 서명을 가져다 쓸 수 없다.
 */

export const SIGNATURE_HEADER = 'x-app-signature';

/** 기기 시계가 조금 틀려도 되게 앞뒤로 열어 둔다 */
export const SIGNATURE_SKEW_MS = 5 * 60 * 1000;

export function signaturePayload(timestamp: number, functionName: string): string {
  return `${timestamp}.${functionName}`;
}

const encoder = new TextEncoder();

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function sign(
  secret: string,
  timestamp: number,
  functionName: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(signaturePayload(timestamp, functionName)),
  );
  return toHex(mac);
}

/** 길이가 같은 두 글자를 시간이 같게 견준다 */
function equals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export type SignatureResult = 'ok' | 'missing' | 'malformed' | 'expired' | 'mismatch';

/**
 * 헤더를 확인한다. 시크릿이 비어 있으면 확인하지 않고 'ok' 다.
 * (아직 Secrets 에 넣지 않은 곳에서도 함수가 돌아야 한다)
 */
export async function verifySignature(
  header: string | null,
  secret: string,
  functionName: string,
  now: number,
): Promise<SignatureResult> {
  if (!secret) return 'ok';
  if (!header) return 'missing';

  const [rawTimestamp, mac] = header.split('.');
  const timestamp = Number(rawTimestamp);
  if (!rawTimestamp || !mac || !Number.isFinite(timestamp)) return 'malformed';
  if (Math.abs(now - timestamp) > SIGNATURE_SKEW_MS) return 'expired';

  return equals(mac, await sign(secret, timestamp, functionName)) ? 'ok' : 'mismatch';
}

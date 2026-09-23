/**
 * 앱 서명 헤더 (SPEC.md 9, 13.3). 빌드할 때 넣은 시크릿과 지금 시각으로 HMAC 을 만들어 보낸다.
 * 서버는 supabase/functions/_shared/signature.ts 가 같은 방식으로 확인한다.
 *
 * 여기는 순수 함수만 둔다. 실제 해시는 expo-crypto 가 하고, client.ts 가 넘겨준다.
 */

export const SIGNATURE_HEADER = 'x-app-signature';

/** .env 에 넣는 이름. 비어 있으면 헤더를 붙이지 않는다 */
export const SIGNATURE_ENV = 'EXPO_PUBLIC_APP_SIGNATURE_SECRET';

/** 해시 한 번. 바이트를 받아 바이트를 돌려준다 */
export type Sha256 = (data: Uint8Array<ArrayBuffer>) => Promise<Uint8Array>;

const encoder = new TextEncoder();
/** SHA-256 의 블록 크기 */
const BLOCK = 64;

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(new ArrayBuffer(a.length + b.length));
  out.set(a);
  out.set(b, a.length);
  return out;
}

/** HMAC-SHA256 (RFC 2104). 기기에 crypto.subtle 이 없어 해시만으로 만든다 */
export async function hmacSha256(sha256: Sha256, secret: string, message: string): Promise<string> {
  const raw = encoder.encode(secret);
  const key = new Uint8Array(new ArrayBuffer(BLOCK));
  key.set(raw.length > BLOCK ? await sha256(raw) : raw);

  const inner = new Uint8Array(new ArrayBuffer(BLOCK));
  const outer = new Uint8Array(new ArrayBuffer(BLOCK));
  for (let i = 0; i < BLOCK; i += 1) {
    inner[i] = key[i] ^ 0x36;
    outer[i] = key[i] ^ 0x5c;
  }

  const first = await sha256(concat(inner, encoder.encode(message)));
  return toHex(await sha256(concat(outer, first)));
}

export function signaturePayload(timestamp: number, functionName: string): string {
  return `${timestamp}.${functionName}`;
}

/** 헤더 값. 시크릿이 없으면 null 이라 헤더를 붙이지 않는다 */
export async function signatureHeader(
  sha256: Sha256,
  secret: string,
  functionName: string,
  now: number,
): Promise<string | null> {
  if (!secret) return null;
  const timestamp = Math.round(now);
  const mac = await hmacSha256(sha256, secret, signaturePayload(timestamp, functionName));
  return `${timestamp}.${mac}`;
}

/**
 * 서버에서 계수를 받아 온다 (SPEC.md 11.2). 계수는 공개 값이라 anon 키로 읽기만 한다.
 * 사용자 데이터는 아무것도 보내지 않는다. 주소와 키는 빌드할 때 환경변수로 넣는다 (SPEC 17).
 */
const TIMEOUT_MS = 8000;

/** 서버 설정이 없으면 null. 그러면 앱은 번들 기본값이나 마지막으로 받은 값으로 돈다 */
export async function fetchCoefficientRows(): Promise<unknown> {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${url}/rest/v1/coefficients?select=key,value`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`coefficients ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

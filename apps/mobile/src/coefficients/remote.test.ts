import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchCoefficientRows, SUPABASE_ENV } from './remote';

const ORIGINAL = { ...process.env };

function setEnv(url?: string, key?: string) {
  if (url === undefined) delete process.env[SUPABASE_ENV.url];
  else process.env[SUPABASE_ENV.url] = url;
  if (key === undefined) delete process.env[SUPABASE_ENV.key];
  else process.env[SUPABASE_ENV.key] = key;
}

/** 한 번 불린 fetch 의 인자를 돌려준다 */
function stubFetch(response: Partial<Response>) {
  const spy = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => [], ...response });
  vi.stubGlobal('fetch', spy);
  return spy;
}

afterEach(() => {
  vi.unstubAllGlobals();
  process.env = { ...ORIGINAL };
});

describe('fetchCoefficientRows (SPEC.md 11.2)', () => {
  it('키는 apikey 헤더로만 보낸다. publishable 키는 JWT 가 아니라 Authorization 으로 보내면 안 된다', async () => {
    const spy = stubFetch({ json: async () => [{ key: 'version', value: 1 }] });
    setEnv('https://demo.supabase.co', 'sb_publishable_test');

    const rows = await fetchCoefficientRows();

    expect(rows).toEqual([{ key: 'version', value: 1 }]);
    const [url, options] = spy.mock.calls[0];
    expect(url).toBe('https://demo.supabase.co/rest/v1/coefficients?select=key,value');
    expect(options.headers).toEqual({ apikey: 'sb_publishable_test' });
  });

  it('주소 끝의 빗금은 지운다', async () => {
    const spy = stubFetch({});
    setEnv('https://demo.supabase.co/', 'sb_publishable_test');

    await fetchCoefficientRows();

    expect(spy.mock.calls[0][0]).toBe('https://demo.supabase.co/rest/v1/coefficients?select=key,value');
  });

  it('서버 설정이 없거나 비어 있으면 부르지 않고 null 이다', async () => {
    const spy = stubFetch({});

    setEnv(undefined, 'sb_publishable_test');
    expect(await fetchCoefficientRows()).toBeNull();

    setEnv('https://demo.supabase.co', undefined);
    expect(await fetchCoefficientRows()).toBeNull();

    setEnv('   ', '   ');
    expect(await fetchCoefficientRows()).toBeNull();

    expect(spy).not.toHaveBeenCalled();
  });

  it('서버가 오류를 주면 던진다. 부르는 쪽이 쓰던 값을 그대로 쓴다', async () => {
    stubFetch({ ok: false, status: 401 });
    setEnv('https://demo.supabase.co', 'sb_publishable_test');

    await expect(fetchCoefficientRows()).rejects.toThrow('401');
  });

  it('사용자 데이터는 보내지 않는다: 읽기 한 번뿐이고 본문이 없다', async () => {
    const spy = stubFetch({});
    setEnv('https://demo.supabase.co', 'sb_publishable_test');

    await fetchCoefficientRows();

    const [, options] = spy.mock.calls[0];
    expect(options.body).toBeUndefined();
    expect(options.method ?? 'GET').toBe('GET');
  });
});

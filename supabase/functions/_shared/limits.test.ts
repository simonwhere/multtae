import { describe, expect, it, vi } from 'vitest';

import { bumpUsage, DEFAULT_CAPS, readCap } from './limits';

const rpcClient = (result: { data?: unknown; error?: unknown }) => ({
  rpc: vi.fn().mockResolvedValue({ data: null, error: null, ...result }),
});

describe('bumpUsage: 하루 호출 수를 센다 (SPEC.md 9.1, 11.3)', () => {
  it('DB 에서 올린 뒤의 값을 돌려준다', async () => {
    const client = rpcClient({ data: 7 });

    await expect(bumpUsage(client, 'identify')).resolves.toBe(7);
    expect(client.rpc).toHaveBeenCalledWith('bump_usage', {
      p_function: 'identify',
      p_subject: '',
    });
  });

  it('기기별 한도는 subject 로 나눠 센다 (진단)', async () => {
    const client = rpcClient({ data: 2 });

    await bumpUsage(client, 'diagnose', 'device-hash');

    expect(client.rpc).toHaveBeenCalledWith('bump_usage', {
      p_function: 'diagnose',
      p_subject: 'device-hash',
    });
  });

  it('DB 가 실패하면 0 이다. 한도 때문에 기능을 막지는 않는다', async () => {
    await expect(bumpUsage(rpcClient({ error: { message: 'boom' } }), 'identify')).resolves.toBe(0);
    await expect(bumpUsage(rpcClient({ data: 'many' }), 'identify')).resolves.toBe(0);
  });
});

describe('readCap: 한도값은 서버에서 고친다 (SPEC.md 11.2)', () => {
  it('coefficients 행에서 읽는다', () => {
    const rows = [
      { key: 'daily_cap_identify', value: 200 },
      { key: 'diagnose_daily_limit', value: 5 },
    ];

    expect(readCap(rows, 'daily_cap_identify', 999)).toBe(200);
    expect(readCap(rows, 'diagnose_daily_limit', 999)).toBe(5);
  });

  it('행이 없거나 숫자가 아니면 기본값이다', () => {
    expect(readCap([], 'daily_cap_identify', 450)).toBe(450);
    expect(readCap([{ key: 'daily_cap_identify', value: '많이' }], 'daily_cap_identify', 450)).toBe(450);
    expect(readCap([{ key: 'daily_cap_identify', value: -1 }], 'daily_cap_identify', 450)).toBe(450);
    expect(readCap(null, 'daily_cap_identify', 450)).toBe(450);
  });

  it('SPEC 의 기본 한도를 안다', () => {
    expect(DEFAULT_CAPS.identify).toBe(450);
    expect(DEFAULT_CAPS.diagnose).toBe(3);
    expect(DEFAULT_CAPS.lightGrade).toBe(300);
    expect(DEFAULT_CAPS.diagnoseTotal).toBe(200);
  });
});

import { describe, expect, it } from 'vitest';

import { readPermission } from './permission';
import type { PermissionResponse } from './permission';

const response = (patch: Partial<PermissionResponse>): PermissionResponse => ({
  granted: false,
  status: 'denied',
  canAskAgain: true,
  provisional: false,
  ...patch,
});

describe('readPermission: 알림 권한', () => {
  it('허용했거나 iOS 임시 허용이면 알림을 띄울 수 있다', () => {
    expect(readPermission(response({ granted: true, status: 'granted' }), true)).toBe('granted');
    expect(readPermission(response({ provisional: true }), true)).toBe('granted');
  });

  it('iOS 는 묻기 전이면 그대로 아직이다', () => {
    expect(readPermission(response({ status: 'undetermined' }), false)).toBe('undetermined');
  });

  it('안드로이드 13 이상은 묻기 전에도 거부로 오지만, 물은 적이 없으면 아직으로 본다', () => {
    expect(readPermission(response({ status: 'denied', canAskAgain: true }), false)).toBe('undetermined');
  });

  it('한 번 물었는데 거부로 오면 거부다. 다시 묻지 않는다', () => {
    expect(readPermission(response({ status: 'denied', canAskAgain: true }), true)).toBe('denied');
  });

  it('더 물을 수 없으면 물은 적이 없어도 거부다 (설정에서 끈 경우)', () => {
    expect(readPermission(response({ status: 'denied', canAskAgain: false }), false)).toBe('denied');
  });
});

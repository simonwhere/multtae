import { useEffect, useState } from 'react';

import { db } from '@/db/client';
import { rescheduleSoon } from '@/notifications';

import { loadCachedCoefficients, refreshCoefficients } from './index';
import { fetchCoefficientRows } from './remote';

/**
 * 앱을 켤 때 기기에 저장해 둔 계수를 읽고(빠르다), 그 뒤에 서버 값을 받아 온다(기다리지 않는다).
 * 서버 값이 바뀌었으면 다음 물주기와 알림을 다시 맞춘다. DB 를 읽으므로 마이그레이션이 끝난 뒤(ready)에 돈다.
 */
export function useCoefficients(ready: boolean): boolean {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;

    void loadCachedCoefficients(db).finally(() => {
      if (cancelled) return;
      setLoaded(true);
      void refreshCoefficients(db, fetchCoefficientRows).then((changed) => {
        if (changed) rescheduleSoon();
      });
    });

    return () => {
      cancelled = true;
    };
  }, [ready]);

  return loaded;
}

/**
 * 지역의 날씨 (SPEC.md 7.1). 기상청 단기예보와 에어코리아 미세먼지 예보를 합쳐 하루 요약으로 준다.
 *
 * 사용자 수와 무관하게 호출량이 고정되도록 서버가 캐시한다. 예보는 격자마다, 미세먼지는 권역마다 한 행이다.
 * 캐시 시간은 coefficients.weather_cache_hours(기본 3시간)로 배포 없이 늘릴 수 있다 (13.3).
 * 받아 오지 못하면 지난 값을 그대로 주고, 앱은 받은 시각을 보고 48시간이 넘으면 날씨를 끈다.
 */
import { createClient } from '@supabase/supabase-js';

import { CORS_HEADERS, fail, json } from '../_shared/http.ts';
import { SIGNATURE_HEADER, verifySignature } from '../_shared/signature.ts';
import { toGrid } from '../_shared/kma-grid.ts';
import type { Grid } from '../_shared/kma-grid.ts';
import { readCap } from '../_shared/limits.ts';
import { findRegion } from '../_shared/regions.ts';
import type { AirArea } from '../_shared/regions.ts';
import {
  airUrl,
  dashed,
  isFresh,
  kmaUrl,
  kstDate,
  latestBase,
  parseAirResponse,
  parseKmaResponse,
  pickDust,
  summarizeDays,
} from '../_shared/weather.ts';
import type { DayForecast, DustGrade, Parsed, WeatherPayload } from '../_shared/weather.ts';

const DEFAULT_CACHE_HOURS = 3;
const TIMEOUT_MS = 10_000;
const THREE_HOURS_MS = 3 * 60 * 60 * 1000;

interface ForecastRow {
  days: DayForecast[];
}
interface DustRow {
  /** YYYY-MM-DD. 미세먼지 예보는 그날의 것만 쓴다 */
  date: string;
  grade: DustGrade | null;
}

async function getText(url: string): Promise<string> {
  const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  return response.text();
}

async function fetchForecast(serviceKey: string, grid: Grid, now: number): Promise<Parsed<DayForecast[]>> {
  const dates = [0, 1, 2].map((offset) => kstDate(now, offset));

  // 발표 직후에는 자료가 아직 없을 수 있다. 그러면 한 번 앞선 발표를 쓴다
  for (const at of [now, now - THREE_HOURS_MS]) {
    let parsed: ReturnType<typeof parseKmaResponse>;
    try {
      parsed = parseKmaResponse(await getText(kmaUrl(serviceKey, grid, latestBase(at))));
    } catch (error) {
      return { ok: false, reason: error instanceof Error ? error.message : 'fetch_failed' };
    }
    if (parsed.ok && parsed.value.length > 0) {
      return { ok: true, value: summarizeDays(parsed.value, dates) };
    }
    if (!parsed.ok && parsed.reason !== 'NO_DATA') return parsed;
  }
  return { ok: false, reason: 'NO_DATA' };
}

async function fetchDust(serviceKey: string, area: AirArea, now: number): Promise<DustGrade | null | 'failed'> {
  const date = kstDate(now);
  const results = await Promise.all(
    (['PM10', 'PM25'] as const).map(async (code) => {
      try {
        return parseAirResponse(await getText(airUrl(serviceKey, code, date)));
      } catch {
        return { ok: false as const, reason: 'fetch_failed' };
      }
    }),
  );

  const items = results.flatMap((result) => (result.ok ? result.value : []));
  if (results.every((result) => !result.ok)) {
    console.error('airkorea', results.map((result) => (result.ok ? 'ok' : result.reason)).join(','));
    return 'failed';
  }
  return pickDust(items, dashed(date), area);
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (request.method !== 'GET') return fail('bad_request', 405);
  // 앱 서명 확인 (SPEC 9, 13.3). 시크릿을 아직 넣지 않았으면 그냥 지나간다
  const signature = await verifySignature(
    request.headers.get(SIGNATURE_HEADER),
    Deno.env.get('APP_SIGNATURE_SECRET') ?? '',
    'weather',
    Date.now(),
  );
  if (signature !== 'ok') return fail('bad_request', 401);


  const region = findRegion(new URL(request.url).searchParams.get('region') ?? '');
  if (!region) return fail('bad_request', 400);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return fail('server', 500);

  // 공공데이터포털 인증키. 기상청과 에어코리아를 같은 키로 부른다
  const serviceKey = Deno.env.get('DATA_GO_KR_SERVICE_KEY');
  if (!serviceKey) return fail('not_configured', 503);

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const now = Date.now();

  const { data: caps } = await supabase.from('coefficients').select('key,value');
  const hours = readCap(caps, 'weather_cache_hours', DEFAULT_CACHE_HOURS);

  const grid = toGrid(region.lat, region.lon);
  const forecastKey = `kma:${grid.nx},${grid.ny}`;
  const dustKey = `air:${region.air}`;

  const { data: rows } = await supabase
    .from('weather_cache')
    .select('region_code,fetched_at,payload')
    .in('region_code', [forecastKey, dustKey]);
  const cached = (key: string) => {
    const row = rows?.find((item) => item.region_code === key);
    return row ? { fetchedAt: Date.parse(row.fetched_at as string), payload: row.payload } : null;
  };

  let forecast = cached(forecastKey) as { fetchedAt: number; payload: ForecastRow } | null;
  if (!forecast || !isFresh(forecast.fetchedAt, now, hours)) {
    const fetched = await fetchForecast(serviceKey, grid, now);
    if (fetched.ok) {
      forecast = { fetchedAt: now, payload: { days: fetched.value } };
      await supabase.from('weather_cache').upsert({
        region_code: forecastKey,
        fetched_at: new Date(now).toISOString(),
        payload: forecast.payload,
      });
    } else {
      // 키가 틀렸거나 한도를 넘었다. 이유를 남기고 지난 값이 있으면 그걸 준다
      console.error('kma', region.id, fetched.reason);
    }
  }
  if (!forecast) return fail('upstream', 502);

  const today = dashed(kstDate(now));
  let dust = cached(dustKey) as { fetchedAt: number; payload: DustRow } | null;
  if (!dust || dust.payload.date !== today || !isFresh(dust.fetchedAt, now, hours)) {
    const grade = await fetchDust(serviceKey, region.air, now);
    if (grade !== 'failed') {
      dust = { fetchedAt: now, payload: { date: today, grade } };
      await supabase.from('weather_cache').upsert({
        region_code: dustKey,
        fetched_at: new Date(now).toISOString(),
        payload: dust.payload,
      });
    }
  }

  const payload: WeatherPayload = {
    region: region.id,
    fetchedAt: forecast.fetchedAt,
    days: forecast.payload.days,
    dust: dust && dust.payload.date === today ? dust.payload.grade : null,
  };
  return json(payload);
});

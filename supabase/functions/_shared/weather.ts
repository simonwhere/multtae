/**
 * 기상청 단기예보와 에어코리아 미세먼지 예보를 앱이 쓰는 모양으로 줄인다 (SPEC.md 7.1).
 * 요청 주소를 만들고 응답을 읽는 순수 함수만 있다. 부르는 일은 weather/index.ts 가 한다.
 *
 * 시각은 모두 한국 시간이다. 기상청 발표 시각과 예보 날짜가 한국 시간으로 적혀 온다.
 */
import type { AirArea } from './regions.ts';
import type { Grid } from './kma-grid.ts';

export const KMA_URL = 'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst';
export const AIR_URL =
  'https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getMinuDustFrcstDspth';

/** 단기예보 발표 시각. 각각 10분 뒤부터 받을 수 있다 (활용가이드) */
const BASE_HOURS = [2, 5, 8, 11, 14, 17, 20, 23];
const RELEASE_DELAY_MINUTES = 10;
/** 사흘치 시간별 예보가 900행 남짓이다. 넘치면 가장 먼 날의 끝이 잘리는데, 쓰는 것은 오늘과 내일이다 */
const KMA_ROWS = 1000;

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const MS_PER_HOUR = 60 * 60 * 1000;

const pad = (value: number, length = 2) => String(value).padStart(length, '0');

/** 한국 시간의 날짜와 시각 */
function kst(nowMs: number): { date: string; hour: number; minute: number } {
  const shifted = new Date(nowMs + KST_OFFSET_MS);
  return {
    date: `${shifted.getUTCFullYear()}${pad(shifted.getUTCMonth() + 1)}${pad(shifted.getUTCDate())}`,
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  };
}

/** 한국 시간 날짜(YYYYMMDD). offsetDays 만큼 앞뒤로 옮긴다 */
export function kstDate(nowMs: number, offsetDays = 0): string {
  return kst(nowMs + offsetDays * 24 * MS_PER_HOUR).date;
}

/** YYYYMMDD → YYYY-MM-DD */
export function dashed(date: string): string {
  return `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
}

/** 지금 받을 수 있는 가장 최근 발표. 02:10 전이면 전날 23시 발표다 */
export function latestBase(nowMs: number): { baseDate: string; baseTime: string } {
  const { date, hour, minute } = kst(nowMs);
  const minutes = hour * 60 + minute;
  const released = BASE_HOURS.filter((base) => base * 60 + RELEASE_DELAY_MINUTES <= minutes);

  if (released.length === 0) {
    return { baseDate: kstDate(nowMs, -1), baseTime: '2300' };
  }
  return { baseDate: date, baseTime: `${pad(released[released.length - 1] ?? 2)}00` };
}

/**
 * 공공데이터포털 인증키. 포털이 주는 두 가지 키 가운데 이미 인코딩된 키(%가 들어 있음)를 넣어도,
 * 인코딩 전 키를 넣어도 같게 동작하게 한다. 두 번 인코딩하면 "등록되지 않은 키" 오류가 난다.
 */
export function serviceKeyParam(serviceKey: string): string {
  const key = serviceKey.trim();
  return key.includes('%') ? key : encodeURIComponent(key);
}

export function kmaUrl(
  serviceKey: string,
  grid: Grid,
  base: { baseDate: string; baseTime: string },
): string {
  const query = [
    `serviceKey=${serviceKeyParam(serviceKey)}`,
    'pageNo=1',
    `numOfRows=${KMA_ROWS}`,
    'dataType=JSON',
    `base_date=${base.baseDate}`,
    `base_time=${base.baseTime}`,
    `nx=${grid.nx}`,
    `ny=${grid.ny}`,
  ];
  return `${KMA_URL}?${query.join('&')}`;
}

export function airUrl(serviceKey: string, informCode: 'PM10' | 'PM25', date: string): string {
  const query = [
    `serviceKey=${serviceKeyParam(serviceKey)}`,
    'returnType=json',
    'numOfRows=100',
    'pageNo=1',
    `searchDate=${dashed(date)}`,
    `InformCode=${informCode}`,
  ];
  return `${AIR_URL}?${query.join('&')}`;
}

export interface KmaItem {
  category: string;
  /** YYYYMMDD */
  fcstDate: string;
  /** HHMM */
  fcstTime: string;
  fcstValue: string;
}

export type Parsed<T> = { ok: true; value: T } | { ok: false; reason: string };

/**
 * 공공데이터포털은 키가 틀리거나 한도를 넘으면 JSON 을 달라고 해도 XML 로 오류를 준다.
 * 어느 쪽이든 읽어서 이유를 돌려준다.
 */
function portalError(text: string): string | null {
  const auth = /<returnAuthMsg>([^<]+)<\/returnAuthMsg>/.exec(text)?.[1];
  const message = /<errMsg>([^<]+)<\/errMsg>/.exec(text)?.[1];
  return auth ?? message ?? null;
}

function parsePortalJson(text: string): Parsed<unknown[]> {
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return { ok: false, reason: portalError(text) ?? 'not_json' };
  }

  const response = (body as { response?: { header?: unknown; body?: unknown } })?.response;
  const header = response?.header as { resultCode?: unknown; resultMsg?: unknown } | undefined;
  if (header?.resultCode !== '00') {
    return { ok: false, reason: String(header?.resultMsg ?? header?.resultCode ?? 'no_header') };
  }

  const items = (response?.body as { items?: unknown } | undefined)?.items;
  // 기상청은 items.item 배열, 에어코리아는 items 배열로 준다
  const list = Array.isArray(items) ? items : (items as { item?: unknown } | undefined)?.item;
  return { ok: true, value: Array.isArray(list) ? list : [] };
}

const isKmaItem = (value: unknown): value is KmaItem => {
  const item = value as Partial<KmaItem> | null;
  return (
    typeof item?.category === 'string' &&
    typeof item.fcstDate === 'string' &&
    typeof item.fcstTime === 'string' &&
    typeof item.fcstValue === 'string'
  );
};

export function parseKmaResponse(text: string): Parsed<KmaItem[]> {
  const parsed = parsePortalJson(text);
  return parsed.ok ? { ok: true, value: parsed.value.filter(isKmaItem) } : parsed;
}

/**
 * 1시간 강수량(PCP) 글자를 mm 로. 범위는 아래쪽 값을 쓴다.
 * 비가 온다고 물주기를 건너뛰는 규칙(7.2)에 쓰므로 많이 오는 쪽으로 어림하지 않는다.
 */
export function parsePrecipitation(value: string): number {
  const text = value.trim();
  if (text === '' || text.includes('강수없음') || text.includes('미만')) return 0;

  const number = /(\d+(?:\.\d+)?)/.exec(text)?.[1];
  return number ? Number(number) : 0;
}

export type Condition = 'clear' | 'cloudy' | 'overcast' | 'rain' | 'snow';

export interface DayForecast {
  /** YYYY-MM-DD */
  date: string;
  /** 최저·최고기온(℃). 발표가 늦어 그날의 값이 빠졌으면 남은 시간의 기온으로 어림한다 */
  tmin: number | null;
  tmax: number | null;
  /** 가장 높은 강수확률(%) */
  pop: number;
  /** 강수량 합(mm) */
  pcp: number;
  /** 가장 센 바람(m/s) */
  windMax: number | null;
  /** 오늘 탭 날씨 아이콘 */
  condition: Condition | null;
}

const toNumber = (value: string): number | null => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const maxOf = (values: (number | null)[]): number | null => {
  const numbers = values.filter((value): value is number => value !== null);
  return numbers.length > 0 ? Math.max(...numbers) : null;
};

const minOf = (values: (number | null)[]): number | null => {
  const numbers = values.filter((value): value is number => value !== null);
  return numbers.length > 0 ? Math.min(...numbers) : null;
};

/** 낮(06~18시)에 가장 자주 나온 하늘 상태. 비나 눈이 한 번이라도 오면 그쪽이다 */
function conditionOf(items: KmaItem[]): Condition | null {
  const daytime = (item: KmaItem) => item.fcstTime >= '0600' && item.fcstTime <= '1800';
  const precipitation = items
    .filter((item) => item.category === 'PTY')
    .map((item) => item.fcstValue);
  // 1 비, 2 비/눈, 3 눈, 4 소나기
  if (precipitation.some((value) => value === '1' || value === '2' || value === '4')) return 'rain';
  if (precipitation.includes('3')) return 'snow';

  const skies = items.filter((item) => item.category === 'SKY');
  const pool = skies.some(daytime) ? skies.filter(daytime) : skies;
  if (pool.length === 0) return null;

  const counts = new Map<string, number>();
  for (const item of pool) counts.set(item.fcstValue, (counts.get(item.fcstValue) ?? 0) + 1);
  // 같은 횟수면 더 흐린 쪽(숫자가 큰 쪽)을 고른다
  const [top] = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0].localeCompare(a[0]));
  // 1 맑음, 3 구름많음, 4 흐림
  const sky = top?.[0];
  return sky === '1' ? 'clear' : sky === '3' ? 'cloudy' : 'overcast';
}

/** 날짜(YYYYMMDD)마다 하루 요약. 예보에 없는 날은 빠진다 */
export function summarizeDays(items: KmaItem[], dates: string[]): DayForecast[] {
  const days: DayForecast[] = [];

  for (const date of dates) {
    const today = items.filter((item) => item.fcstDate === date);
    if (today.length === 0) continue;

    const values = (category: string) =>
      today.filter((item) => item.category === category).map((item) => item.fcstValue);
    const numbers = (category: string) => values(category).map(toNumber);

    days.push({
      date: dashed(date),
      tmin: minOf(numbers('TMN')) ?? minOf(numbers('TMP')),
      tmax: maxOf(numbers('TMX')) ?? maxOf(numbers('TMP')),
      pop: maxOf(numbers('POP')) ?? 0,
      pcp: Math.round(values('PCP').reduce((sum, value) => sum + parsePrecipitation(value), 0) * 10) / 10,
      windMax: maxOf(numbers('WSD')),
      condition: conditionOf(today),
    });
  }

  return days;
}

export type DustGrade = 'good' | 'moderate' | 'bad' | 'very_bad';

const DUST_GRADES: Record<string, DustGrade> = {
  좋음: 'good',
  보통: 'moderate',
  나쁨: 'bad',
  매우나쁨: 'very_bad',
};
const DUST_ORDER: DustGrade[] = ['good', 'moderate', 'bad', 'very_bad'];

/** "서울 : 보통,제주 : 좋음,..." 에서 권역의 등급 */
export function parseDustGrade(informGrade: string, area: AirArea): DustGrade | null {
  for (const part of informGrade.split(',')) {
    const [name, grade] = part.split(':').map((text) => text.trim());
    if (name === area) return DUST_GRADES[grade?.replace(/\s/g, '') ?? ''] ?? null;
  }
  return null;
}

export interface AirItem {
  informCode: string;
  /** 예보 대상 날짜 YYYY-MM-DD */
  informData: string;
  informGrade: string;
  /** "2026-09-22 05시 발표" */
  dataTime: string;
}

const isAirItem = (value: unknown): value is AirItem => {
  const item = value as Partial<AirItem> | null;
  return (
    typeof item?.informCode === 'string' &&
    typeof item.informData === 'string' &&
    typeof item.informGrade === 'string' &&
    typeof item.dataTime === 'string'
  );
};

export function parseAirResponse(text: string): Parsed<AirItem[]> {
  const parsed = parsePortalJson(text);
  return parsed.ok ? { ok: true, value: parsed.value.filter(isAirItem) } : parsed;
}

/** 그날(YYYY-MM-DD)을 가장 늦게 발표한 예보에서 권역의 등급. PM10 과 PM2.5 가운데 나쁜 쪽 */
export function pickDust(items: AirItem[], date: string, area: AirArea): DustGrade | null {
  let worst: DustGrade | null = null;

  for (const code of ['PM10', 'PM25']) {
    const latest = items
      .filter((item) => item.informCode === code && item.informData === date)
      .sort((a, b) => b.dataTime.localeCompare(a.dataTime))[0];
    const grade = latest ? parseDustGrade(latest.informGrade, area) : null;
    if (grade && (!worst || DUST_ORDER.indexOf(grade) > DUST_ORDER.indexOf(worst))) worst = grade;
  }

  return worst;
}

/** 캐시가 아직 쓸 만한가 (7.1 지역별 3시간) */
export function isFresh(fetchedAtMs: number, nowMs: number, hours: number): boolean {
  return nowMs - fetchedAtMs < hours * MS_PER_HOUR && fetchedAtMs <= nowMs;
}

/** 앱이 받는 날씨 */
export interface WeatherPayload {
  region: string;
  /** 예보를 받은 시각(epoch ms). 앱은 48시간이 넘으면 날씨를 끈다 (7.1) */
  fetchedAt: number;
  days: DayForecast[];
  /** 오늘 미세먼지 예보. 못 받았으면 null */
  dust: DustGrade | null;
}

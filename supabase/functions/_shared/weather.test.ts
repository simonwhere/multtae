import { describe, expect, it } from 'vitest';

import {
  airUrl,
  dashed,
  isFresh,
  kmaUrl,
  kstDate,
  latestBase,
  parseAirResponse,
  parseDustGrade,
  parseKmaResponse,
  parsePrecipitation,
  pickDust,
  serviceKeyParam,
  summarizeDays,
} from './weather';
import type { AirItem, KmaItem } from './weather';

/** 한국 시간 2026년 month/day hour:minute 의 epoch ms */
const kstAt = (month: number, day: number, hour: number, minute = 0) =>
  Date.UTC(2026, month - 1, day, hour - 9, minute);

describe('latestBase: 지금 받을 수 있는 가장 최근 발표 (기상청 단기예보)', () => {
  it('발표 10분 뒤부터 그 발표를 쓴다', () => {
    expect(latestBase(kstAt(9, 22, 5, 9))).toEqual({ baseDate: '20260922', baseTime: '0200' });
    expect(latestBase(kstAt(9, 22, 5, 10))).toEqual({ baseDate: '20260922', baseTime: '0500' });
    expect(latestBase(kstAt(9, 22, 23, 30))).toEqual({ baseDate: '20260922', baseTime: '2300' });
  });

  it('02:10 전이면 전날 23시 발표다. 달과 해가 바뀌어도 그렇다', () => {
    expect(latestBase(kstAt(9, 22, 2, 0))).toEqual({ baseDate: '20260921', baseTime: '2300' });
    expect(latestBase(Date.UTC(2027, 0, 1, 1 - 9))).toEqual({
      baseDate: '20261231',
      baseTime: '2300',
    });
  });

  it('기기 시간대와 무관하게 한국 시간으로 센다', () => {
    // UTC 로는 9/21 20:30 이지만 한국은 9/22 05:30
    expect(latestBase(Date.UTC(2026, 8, 21, 20, 30))).toEqual({
      baseDate: '20260922',
      baseTime: '0500',
    });
  });
});

describe('날짜', () => {
  it('한국 날짜와 대시 모양', () => {
    expect(kstDate(kstAt(9, 22, 23, 59))).toBe('20260922');
    expect(kstDate(kstAt(9, 22, 23, 59), 1)).toBe('20260923');
    expect(dashed('20260922')).toBe('2026-09-22');
  });
});

describe('요청 주소', () => {
  it('인증키는 인코딩 전 키든 인코딩된 키든 한 번만 인코딩된다', () => {
    expect(serviceKeyParam('ab+c/d==')).toBe('ab%2Bc%2Fd%3D%3D');
    expect(serviceKeyParam(' ab%2Bc%2Fd%3D%3D ')).toBe('ab%2Bc%2Fd%3D%3D');
  });

  it('기상청 단기예보 주소', () => {
    const url = kmaUrl('key', { nx: 60, ny: 127 }, { baseDate: '20260922', baseTime: '0500' });

    expect(url).toContain('VilageFcstInfoService_2.0/getVilageFcst?serviceKey=key');
    expect(url).toContain('dataType=JSON');
    expect(url).toContain('base_date=20260922&base_time=0500&nx=60&ny=127');
  });

  it('에어코리아 미세먼지 예보 주소', () => {
    const url = airUrl('key', 'PM25', '20260922');

    expect(url).toContain('getMinuDustFrcstDspth?serviceKey=key');
    expect(url).toContain('returnType=json');
    expect(url).toContain('searchDate=2026-09-22&InformCode=PM25');
  });
});

const kmaBody = (items: KmaItem[], resultCode = '00') =>
  JSON.stringify({
    response: {
      header: { resultCode, resultMsg: resultCode === '00' ? 'NORMAL_SERVICE' : 'NO_DATA' },
      body: { dataType: 'JSON', items: { item: items } },
    },
  });

const item = (category: string, fcstDate: string, fcstTime: string, fcstValue: string): KmaItem => ({
  category,
  fcstDate,
  fcstTime,
  fcstValue,
});

describe('parseKmaResponse', () => {
  it('예보 항목을 읽는다', () => {
    const items = [item('TMP', '20260922', '0600', '14')];

    expect(parseKmaResponse(kmaBody(items))).toEqual({ ok: true, value: items });
  });

  it('결과 코드가 00 이 아니면 실패', () => {
    expect(parseKmaResponse(kmaBody([], '03'))).toEqual({ ok: false, reason: 'NO_DATA' });
  });

  it('키 오류는 XML 로 와도 이유를 읽는다', () => {
    const xml =
      '<OpenAPI_ServiceResponse><cmmMsgHeader><errMsg>SERVICE ERROR</errMsg>' +
      '<returnAuthMsg>SERVICE_KEY_IS_NOT_REGISTERED_ERROR</returnAuthMsg></cmmMsgHeader></OpenAPI_ServiceResponse>';

    expect(parseKmaResponse(xml)).toEqual({
      ok: false,
      reason: 'SERVICE_KEY_IS_NOT_REGISTERED_ERROR',
    });
    expect(parseKmaResponse('Unexpected errors')).toEqual({ ok: false, reason: 'not_json' });
  });

  it('모양이 다른 항목은 버린다', () => {
    const body = kmaBody([item('TMP', '20260922', '0600', '14'), { category: 'TMP' } as KmaItem]);

    expect(parseKmaResponse(body)).toMatchObject({ ok: true, value: [{ fcstValue: '14' }] });
  });
});

describe('parsePrecipitation: 1시간 강수량 글자 → mm', () => {
  it.each([
    ['강수없음', 0],
    ['1mm 미만', 0],
    ['1.0mm 미만', 0],
    ['6.2mm', 6.2],
    ['6.2', 6.2],
    ['30.0~50.0mm', 30],
    ['50.0mm 이상', 50],
    ['', 0],
  ])('%s → %d', (text, mm) => {
    expect(parsePrecipitation(text)).toBe(mm);
  });
});

describe('summarizeDays: 하루 요약', () => {
  const today = '20260922';
  const tomorrow = '20260923';
  const items = [
    item('TMN', today, '0600', '12.0'),
    item('TMX', today, '1500', '26.0'),
    item('TMP', today, '0600', '13'),
    item('TMP', today, '1500', '25'),
    item('POP', today, '0600', '20'),
    item('POP', today, '1500', '70'),
    item('PCP', today, '1400', '3.0mm'),
    item('PCP', today, '1500', '2.5mm'),
    item('PCP', today, '1600', '강수없음'),
    item('WSD', today, '0600', '2.1'),
    item('WSD', today, '1500', '6.4'),
    item('PTY', today, '1400', '1'),
    item('SKY', today, '0900', '4'),
    // 내일은 발표가 늦어 TMN·TMX 가 빠졌다고 치자
    item('TMP', tomorrow, '0300', '-6'),
    item('TMP', tomorrow, '1500', '2'),
    item('SKY', tomorrow, '0900', '1'),
    item('SKY', tomorrow, '1200', '1'),
    item('SKY', tomorrow, '1500', '3'),
    item('PTY', tomorrow, '0900', '0'),
  ];

  it('최저·최고기온, 가장 높은 강수확률, 강수량 합, 가장 센 바람', () => {
    expect(summarizeDays(items, [today])).toEqual([
      {
        date: '2026-09-22',
        tmin: 12,
        tmax: 26,
        pop: 70,
        pcp: 5.5,
        windMax: 6.4,
        condition: 'rain',
      },
    ]);
  });

  it('최저·최고가 빠졌으면 시간별 기온으로 어림하고, 하늘은 낮에 가장 자주 나온 상태다', () => {
    expect(summarizeDays(items, [tomorrow])).toEqual([
      {
        date: '2026-09-23',
        tmin: -6,
        tmax: 2,
        pop: 0,
        pcp: 0,
        windMax: null,
        condition: 'clear',
      },
    ]);
  });

  it('예보에 없는 날은 빠진다', () => {
    expect(summarizeDays(items, ['20260930'])).toEqual([]);
  });

  it('눈과 흐림', () => {
    expect(summarizeDays([item('PTY', today, '0900', '3')], [today])[0]?.condition).toBe('snow');
    expect(
      summarizeDays(
        [item('SKY', today, '0300', '1'), item('SKY', today, '0900', '4'), item('SKY', today, '1200', '4')],
        [today],
      )[0]?.condition,
    ).toBe('overcast');
    expect(summarizeDays([item('TMP', today, '0900', '10')], [today])[0]?.condition).toBeNull();
  });
});

describe('미세먼지 예보 (에어코리아)', () => {
  const grade = '서울 : 나쁨,제주 : 좋음,경기북부 : 매우나쁨,경기남부 : 보통,영동 : 예보없음';

  it('권역의 등급을 읽는다', () => {
    expect(parseDustGrade(grade, '서울')).toBe('bad');
    expect(parseDustGrade(grade, '제주')).toBe('good');
    expect(parseDustGrade(grade, '경기북부')).toBe('very_bad');
    expect(parseDustGrade(grade, '영동')).toBeNull();
    expect(parseDustGrade(grade, '부산')).toBeNull();
  });

  const air = (informCode: string, informData: string, dataTime: string, informGrade: string): AirItem => ({
    informCode,
    informData,
    informGrade,
    dataTime,
  });

  it('그날을 가장 늦게 발표한 예보에서 PM10·PM2.5 가운데 나쁜 쪽', () => {
    const items = [
      air('PM10', '2026-09-22', '2026-09-21 17시 발표', '서울 : 매우나쁨'),
      air('PM10', '2026-09-22', '2026-09-22 05시 발표', '서울 : 보통'),
      air('PM25', '2026-09-22', '2026-09-22 05시 발표', '서울 : 나쁨'),
      air('PM25', '2026-09-23', '2026-09-22 05시 발표', '서울 : 매우나쁨'),
    ];

    expect(pickDust(items, '2026-09-22', '서울')).toBe('bad');
    expect(pickDust(items, '2026-09-24', '서울')).toBeNull();
  });

  it('응답을 읽는다', () => {
    const body = JSON.stringify({
      response: {
        header: { resultCode: '00', resultMsg: 'NORMAL_CODE' },
        body: { items: [air('PM10', '2026-09-22', '2026-09-22 05시 발표', '서울 : 보통')] },
      },
    });

    expect(parseAirResponse(body)).toMatchObject({ ok: true, value: [{ informCode: 'PM10' }] });
  });
});

describe('isFresh: 캐시 (SPEC.md 7.1 지역별 3시간)', () => {
  const now = kstAt(9, 22, 12);

  it('3시간 안이면 쓴다', () => {
    expect(isFresh(now - 2.9 * 3_600_000, now, 3)).toBe(true);
    expect(isFresh(now - 3 * 3_600_000, now, 3)).toBe(false);
  });

  it('미래 시각이 적혀 있으면 믿지 않는다', () => {
    expect(isFresh(now + 60_000, now, 3)).toBe(false);
  });
});

/**
 * 지역의 날씨를 받는다 (SPEC.md 7.1). 서버가 기상청·에어코리아를 부르고 지역별로 캐시한다.
 * 위치 권한은 쓰지 않는다. 사용자가 고른 지역 id 만 보낸다.
 */
import { parseWeather } from '@/weather/forecast';
import type { Weather } from '@/weather/forecast';

import { callFunction, FunctionError } from './client';

export type WeatherOutcome =
  | { kind: 'weather'; weather: Weather }
  /** 서버에 공공데이터포털 키가 아직 없다. 날씨 기능만 끈다 */
  | { kind: 'not_configured' }
  /** 서버 설정이 없거나 닿지 않는다. 지난 값을 쓴다 */
  | { kind: 'unavailable' };

export async function fetchWeather(regionId: string): Promise<WeatherOutcome> {
  try {
    const body = await callFunction<unknown>('weather', { search: { region: regionId } });
    const weather = parseWeather(body);
    return weather ? { kind: 'weather', weather } : { kind: 'unavailable' };
  } catch (error) {
    if (error instanceof FunctionError && error.code === 'not_configured') {
      return { kind: 'not_configured' };
    }
    return { kind: 'unavailable' };
  }
}

import { create } from 'zustand';

import type { Weather } from './forecast';

interface WeatherState {
  /** 고른 지역의 마지막 예보. 지역이 없거나 받은 적 없으면 null */
  weather: Weather | null;
  /** 서버에 날씨 키가 아직 없다. 설정 화면에서 안내한다 */
  notConfigured: boolean;
  setWeather: (weather: Weather | null, notConfigured?: boolean) => void;
}

/** 오늘 탭과 설정 화면이 같은 날씨를 본다 */
export const useWeatherState = create<WeatherState>((set) => ({
  weather: null,
  notConfigured: false,
  setWeather: (weather, notConfigured = false) => set({ weather, notConfigured }),
}));

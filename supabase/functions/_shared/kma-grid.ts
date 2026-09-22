/**
 * 위경도를 기상청 동네예보 격자(nx, ny)로 바꾼다 (SPEC.md 7.1).
 * 기상청 단기예보 오픈API 활용가이드의 LCC(람베르트 정각원추) 변환식을 그대로 옮겼다. 격자 간격은 5km 다.
 */

const EARTH_RADIUS_KM = 6371.00877;
const GRID_KM = 5.0;
const STANDARD_LAT_1 = 30.0;
const STANDARD_LAT_2 = 60.0;
const ORIGIN_LON = 126.0;
const ORIGIN_LAT = 38.0;
const ORIGIN_X = 43;
const ORIGIN_Y = 136;

const DEG = Math.PI / 180;

const re = EARTH_RADIUS_KM / GRID_KM;
const slat1 = STANDARD_LAT_1 * DEG;
const slat2 = STANDARD_LAT_2 * DEG;
const olon = ORIGIN_LON * DEG;
const olat = ORIGIN_LAT * DEG;

const sn =
  Math.log(Math.cos(slat1) / Math.cos(slat2)) /
  Math.log(Math.tan(Math.PI * 0.25 + slat2 * 0.5) / Math.tan(Math.PI * 0.25 + slat1 * 0.5));
const sf = (Math.pow(Math.tan(Math.PI * 0.25 + slat1 * 0.5), sn) * Math.cos(slat1)) / sn;
const ro = (re * sf) / Math.pow(Math.tan(Math.PI * 0.25 + olat * 0.5), sn);

export interface Grid {
  nx: number;
  ny: number;
}

export function toGrid(lat: number, lon: number): Grid {
  const ra = (re * sf) / Math.pow(Math.tan(Math.PI * 0.25 + lat * DEG * 0.5), sn);
  let theta = lon * DEG - olon;
  if (theta > Math.PI) theta -= 2 * Math.PI;
  if (theta < -Math.PI) theta += 2 * Math.PI;
  theta *= sn;

  return {
    nx: Math.floor(ra * Math.sin(theta) + ORIGIN_X + 0.5),
    ny: Math.floor(ro - ra * Math.cos(theta) + ORIGIN_Y + 0.5),
  };
}

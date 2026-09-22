/**
 * 경고 카드 문구 (SPEC 3.2). 규칙이 고른 카드를 제목과 본문으로 바꾼다. 화면과 떼어 테스트한다.
 * 경고(한파·서리·폭염·강풍·겨울나기)는 자줏빛 면, 안내(미세먼지·습도·장마)는 연두 면에 그린다.
 */
import { ko } from '../i18n/ko';
import type { WinterWarning } from '../plants/winter';
import type { WeatherCard } from './rules';

/** 카드에 적는 식물 이름 수. 나머지는 "외 N개" */
const SHOWN_NAMES = 3;

export interface CardText {
  /** 닫은 카드를 기억하는 키 */
  key: string;
  title: string;
  body: string;
  tone: 'warning' | 'tip';
}

export function listNames(names: readonly string[]): string {
  const shown = names.slice(0, SHOWN_NAMES).join(', ');
  return names.length > SHOWN_NAMES ? ko.cards.more(shown, names.length - SHOWN_NAMES) : shown;
}

export function cardText(card: WeatherCard): CardText {
  const t = ko.cards;
  switch (card.kind) {
    case 'heat':
      return { key: 'heat', title: t.heatTitle, body: t.heat(listNames(card.names)), tone: 'warning' };
    case 'cold':
      return {
        key: 'cold',
        title: t.coldTitle,
        body: [
          t.cold(card.when, card.low, listNames(card.names)),
          card.bonsai ? t.coldBonsai : null,
          card.balcony ? t.coldBalcony : null,
        ]
          .filter((line): line is string => line !== null)
          .join(' '),
        tone: 'warning',
      };
    case 'frost':
      return {
        key: 'frost',
        title: t.frostTitle,
        body: t.frost(card.when, card.low, listNames(card.names)),
        tone: 'warning',
      };
    case 'wind':
      return {
        key: 'wind',
        title: t.windTitle,
        body:
          card.small.length > 0
            ? `${t.wind(listNames(card.names))} ${t.windSmall(listNames(card.small))}`
            : t.wind(listNames(card.names)),
        tone: 'warning',
      };
    case 'dust':
      return { key: 'dust', title: t.dustTitle, body: t.dust, tone: 'tip' };
    case 'humidity':
      return { key: 'humidity', title: t.humidityTitle, body: t.humidity, tone: 'tip' };
    case 'monsoon':
      return { key: 'monsoon', title: t.monsoonTitle, body: t.monsoon, tone: 'tip' };
  }
}

/** 분재 월동 경고 (6.3)도 같은 카드로 그린다 */
export function winterCardText(warning: WinterWarning): CardText {
  return {
    key: `winter-${warning.kind}`,
    title: ko.cards.winterTitle,
    body: ko.today.winter[warning.kind](listNames(warning.nicknames)),
    tone: 'warning',
  };
}

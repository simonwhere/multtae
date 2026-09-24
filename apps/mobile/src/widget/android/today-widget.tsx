'use no memo';
// 안드로이드 홈 화면 위젯의 모양 (9-3). 위젯 라이브러리는 함수를 그대로 불러 읽어서
// React Compiler 가 바꾼 함수는 읽지 못한다. 그래서 이 파일은 컴파일러를 끈다.
import { FlexWidget, TextWidget } from 'react-native-android-widget';
import type { HexColor } from 'react-native-android-widget';

import { keepHangulWords as keep } from '@/lib/keep-words';

import type { WidgetColors, WidgetDay } from '../snapshot';

type Palette = Record<keyof WidgetColors, HexColor>;

export interface TodayWidgetProps {
  /** 오늘 것. 없으면 message 만 보여 준다 */
  day: WidgetDay | null;
  message: string;
  colors: WidgetColors;
  /** 이름을 몇 줄까지 쓰는지. 위젯 크기에 따라 다르다 */
  lines: number;
}

function DayView({ day, colors, lines }: { day: WidgetDay; colors: Palette; lines: number }) {
  return (
    <FlexWidget style={{ width: 'match_parent', flexDirection: 'column', flexGap: 4 }}>
      <FlexWidget
        style={{
          width: 'match_parent',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
        <TextWidget
          text={keep(`${day.dateLabel} ${day.weekday}`)}
          style={{ fontSize: 13, fontWeight: '600', color: colors.sub }}
        />
        {day.count > 0 ? (
          <TextWidget
            text={String(day.count)}
            style={{ fontSize: 26, fontWeight: '600', color: colors.accent }}
          />
        ) : null}
      </FlexWidget>
      <TextWidget
        text={keep(day.headline)}
        maxLines={2}
        truncate="END"
        style={{ fontSize: 15, fontWeight: '600', color: colors.ink }}
      />
      {day.lines.slice(0, lines).map((line, index) => (
        <FlexWidget
          key={index}
          style={{
            width: 'match_parent',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
          <TextWidget
            text={keep(line.name)}
            maxLines={1}
            truncate="END"
            style={{ fontSize: 14, color: colors.ink }}
          />
          {/* 밀린 것은 색과 함께 "2일 지남" 글자로도 말한다 */}
          <TextWidget
            text={keep(line.tag)}
            style={{
              fontSize: 12,
              fontWeight: '600',
              color: line.overdue ? colors.berry : colors.sub,
            }}
          />
        </FlexWidget>
      ))}
      {day.more ? <TextWidget text={keep(day.more)} style={{ fontSize: 12, color: colors.sub }} /> : null}
      {day.next ? (
        <TextWidget text={keep(day.next)} maxLines={2} style={{ fontSize: 12, color: colors.sub }} />
      ) : null}
    </FlexWidget>
  );
}

export function TodayWidget({ day, message, colors, lines }: TodayWidgetProps) {
  const palette = colors as Palette;
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        width: 'match_parent',
        height: 'match_parent',
        flexDirection: 'column',
        backgroundColor: palette.paper,
        borderRadius: 20,
        padding: 14,
      }}>
      {day ? (
        <DayView day={day} colors={palette} lines={lines} />
      ) : (
        <TextWidget text={keep(message)} maxLines={3} style={{ fontSize: 14, color: palette.sub }} />
      )}
    </FlexWidget>
  );
}

import SwiftUI
import WidgetKit

// 홈 화면 위젯 (9-3). 앱이 공유 저장소에 넣어 둔 내용(src/widget/snapshot.ts)을 그대로 그린다.
// 문구와 색은 모두 앱이 만들어 넘긴다. 여기서는 오늘 날짜에 맞는 날을 고르기만 한다.

private let appGroup = "group.kr.multtae.app"
private let snapshotKey = "snapshot"
/// src/widget/snapshot.ts 의 WIDGET_VERSION
private let supportedVersion = 1

struct SnapshotLine: Decodable, Hashable {
  let name: String
  let tag: String
  let overdue: Bool
}

struct SnapshotDay: Decodable {
  let date: String
  let dateLabel: String
  let weekday: String
  let count: Int
  let headline: String
  let lines: [SnapshotLine]
  let more: String?
  let next: String?
}

struct SnapshotColors: Decodable {
  let paper: String
  let surface: String
  let ink: String
  let sub: String
  let accent: String
  let highlight: String
  let berry: String
  let berryTint: String
}

struct SnapshotPalette: Decodable {
  let light: SnapshotColors
  let dark: SnapshotColors
}

struct Snapshot: Decodable {
  let version: Int
  let stale: String
  let colors: SnapshotPalette
  let days: [SnapshotDay]
}

struct TodayEntry: TimelineEntry {
  let date: Date
  let day: SnapshotDay?
  let stale: String?
  let palette: SnapshotPalette?
}

struct TodayProvider: TimelineProvider {
  func placeholder(in context: Context) -> TodayEntry {
    TodayEntry(date: .now, day: nil, stale: nil, palette: nil)
  }

  func getSnapshot(in context: Context, completion: @escaping (TodayEntry) -> Void) {
    completion(makeEntries().first ?? placeholder(in: context))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<TodayEntry>) -> Void) {
    // 내용은 앱이 바꿀 때만 바뀌고, 그때 앱이 위젯을 다시 불러 준다. 위젯이 스스로 다시 묻지 않는다
    completion(Timeline(entries: makeEntries(), policy: .never))
  }

  private func load() -> Snapshot? {
    guard
      let json = UserDefaults(suiteName: appGroup)?.string(forKey: snapshotKey),
      let data = json.data(using: .utf8),
      let snapshot = try? JSONDecoder().decode(Snapshot.self, from: data),
      snapshot.version == supportedVersion
    else { return nil }
    return snapshot
  }

  /// 날마다 자정에 넘어간다. 만들어 둔 날을 다 쓰면 앱을 열어 달라는 말을 보여 준다
  private func makeEntries() -> [TodayEntry] {
    guard let snapshot = load() else {
      return [TodayEntry(date: .now, day: nil, stale: nil, palette: nil)]
    }

    let calendar = Calendar.current
    let formatter = DateFormatter()
    formatter.calendar = calendar
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.timeZone = calendar.timeZone
    formatter.dateFormat = "yyyy-MM-dd"

    let today = calendar.startOfDay(for: .now)
    var entries: [TodayEntry] = []
    var lastDay: Date?
    for day in snapshot.days {
      guard let start = formatter.date(from: day.date), start >= today else { continue }
      entries.append(
        TodayEntry(date: start == today ? .now : start, day: day, stale: nil, palette: snapshot.colors))
      lastDay = start
    }

    let staleFrom = lastDay.flatMap { calendar.date(byAdding: .day, value: 1, to: $0) } ?? .now
    entries.append(TodayEntry(date: staleFrom, day: nil, stale: snapshot.stale, palette: snapshot.colors))
    return entries
  }
}

extension Color {
  /// "#2F5F49" 모양의 토큰 값
  init(hex: String) {
    var value: UInt64 = 0
    Scanner(string: hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))).scanHexInt64(&value)
    self.init(
      red: Double((value >> 16) & 0xFF) / 255,
      green: Double((value >> 8) & 0xFF) / 255,
      blue: Double(value & 0xFF) / 255)
  }
}

extension View {
  @ViewBuilder
  func widgetBackground(_ color: Color) -> some View {
    if #available(iOS 17.0, *) {
      containerBackground(color, for: .widget)
    } else {
      background(color)
    }
  }
}

struct TodayWidgetView: View {
  @Environment(\.colorScheme) private var scheme
  @Environment(\.widgetFamily) private var family
  let entry: TodayEntry

  private var tokens: SnapshotColors? {
    guard let palette = entry.palette else { return nil }
    return scheme == .dark ? palette.dark : palette.light
  }

  var body: some View {
    let ink = tokens.map { Color(hex: $0.ink) } ?? .primary
    let sub = tokens.map { Color(hex: $0.sub) } ?? .secondary
    let accent = tokens.map { Color(hex: $0.accent) } ?? .primary
    let berry = tokens.map { Color(hex: $0.berry) } ?? .primary
    let paper = tokens.map { Color(hex: $0.paper) } ?? Color(.systemBackground)

    content(ink: ink, sub: sub, accent: accent, berry: berry)
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
      .widgetBackground(paper)
      .widgetURL(URL(string: "multtae://"))
  }

  @ViewBuilder
  private func content(ink: Color, sub: Color, accent: Color, berry: Color) -> some View {
    if let day = entry.day {
      VStack(alignment: .leading, spacing: 5) {
        HStack(alignment: .firstTextBaseline, spacing: 4) {
          Text(day.dateLabel).font(.system(size: 13, weight: .semibold)).foregroundStyle(sub)
          Text(day.weekday).font(.system(size: 13)).foregroundStyle(sub)
          Spacer(minLength: 0)
          if day.count > 0 {
            Text("\(day.count)")
              .font(.system(size: family == .systemSmall ? 32 : 26, weight: .semibold))
              .foregroundStyle(accent)
          }
        }
        Text(day.headline)
          .font(.system(size: 15, weight: .semibold))
          .foregroundStyle(ink)
          .lineLimit(2)
        ForEach(Array(day.lines.prefix(family == .systemSmall ? 2 : 3)), id: \.self) { line in
          HStack(spacing: 4) {
            Text(line.name).font(.system(size: 14)).foregroundStyle(ink).lineLimit(1)
            Spacer(minLength: 4)
            // 밀린 것은 색과 함께 "2일 지남" 글자로도 말한다
            Text(line.tag)
              .font(.system(size: 12, weight: .semibold))
              .foregroundStyle(line.overdue ? berry : sub)
          }
        }
        if let more = day.more {
          Text(more).font(.system(size: 12)).foregroundStyle(sub)
        }
        if let next = day.next {
          Text(next).font(.system(size: 12)).foregroundStyle(sub).lineLimit(2)
        }
      }
    } else if let stale = entry.stale {
      Text(stale).font(.system(size: 14)).foregroundStyle(sub)
    } else {
      // 앱을 한 번도 열지 않았다. 글자 없이 잎만 둔다
      Image(systemName: "leaf").font(.system(size: 28)).foregroundStyle(accent)
    }
  }
}

struct TodayWidget: Widget {
  let kind = "TodayWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: TodayProvider()) { entry in
      TodayWidgetView(entry: entry)
    }
    // 위젯 목록의 이름과 설명. 앱을 열기 전에도 보여야 해서 여기에만 글자를 둔다.
    // ko.ts 의 widget.galleryName·galleryDescription 과 같아야 한다 (src/widget/swift-parity.test.ts)
    .configurationDisplayName("물때")
    .description("오늘 물 줄 식물을 보여 드려요")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}

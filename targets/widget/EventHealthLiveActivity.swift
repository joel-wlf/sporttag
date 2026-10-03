import ActivityKit
import WidgetKit
import SwiftUI

/// Läuft parallel zur gleichnamigen Struktur in
/// modules/sporttag-live-activity/ios/SporttagLiveActivityModule.swift –
/// beide müssen exakt übereinstimmen, da App-Target und Widget-Extension
/// getrennt kompiliert werden.
struct EventHealthActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var attention: Int
        var running: Int
        var ready: Int
        var done: Int
        var other: Int
        var topIssue: String?
        var topIssueReason: String?
        var roundLabel: String?
        var roundEndsAt: Date?
    }

    var eventName: String
    var deepLinkUrl: String
}

struct EventHealthLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: EventHealthActivityAttributes.self) { context in
            EventHealthLockScreenView(attributes: context.attributes, state: context.state)
                .activityBackgroundTint(SporttagColors.background)
                .activitySystemActionForegroundColor(Color.white)
                .widgetURL(URL(string: context.attributes.deepLinkUrl))
        } dynamicIsland: { context in
            let state = context.state
            return DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    HealthHeadline(state: state)
                        .padding(.leading, 4)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    if let ends = state.roundEndsAt {
                        CountdownText(ends: ends)
                            .font(.headline)
                            .foregroundStyle(.white)
                            .padding(.trailing, 4)
                    }
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(alignment: .leading, spacing: 8) {
                        StationStatusBar(state: state)
                        TopIssueRow(state: state)
                    }
                    .padding(.horizontal, 4)
                }
            } compactLeading: {
                StatusGlyph(state: state)
            } compactTrailing: {
                if state.attention > 0 {
                    Text("\(state.attention)")
                        .font(.caption.bold())
                        .foregroundStyle(SporttagColors.danger)
                } else {
                    HStack(spacing: 2) {
                        Image(systemName: "play.fill").font(.system(size: 9, weight: .bold))
                        Text("\(state.running)").font(.caption.bold())
                    }
                    .foregroundStyle(SporttagColors.running)
                }
            } minimal: {
                StatusGlyph(state: state)
            }
            .widgetURL(URL(string: context.attributes.deepLinkUrl))
            .keylineTint(state.attention > 0 ? SporttagColors.danger : SporttagColors.running)
        }
    }
}

private struct EventHealthLockScreenView: View {
    let attributes: EventHealthActivityAttributes
    let state: EventHealthActivityAttributes.ContentState

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 1) {
                    Text(attributes.eventName.uppercased())
                        .font(.system(size: 11, weight: .black))
                        .foregroundStyle(.white.opacity(0.6))
                        .lineLimit(1)
                    if let round = state.roundLabel {
                        Text(round)
                            .font(.subheadline.bold())
                            .foregroundStyle(.white)
                    }
                }
                Spacer()
                if let ends = state.roundEndsAt {
                    HStack(spacing: 4) {
                        Image(systemName: "timer").font(.caption.bold())
                        CountdownText(ends: ends).font(.headline)
                    }
                    .foregroundStyle(.white)
                }
            }

            StationStatusBar(state: state)

            HStack(spacing: 8) {
                CountTile(symbol: "exclamationmark.triangle.fill", count: state.attention, label: "Probleme", color: SporttagColors.danger)
                CountTile(symbol: "play.fill", count: state.running, label: "Läuft", color: SporttagColors.running)
                CountTile(symbol: "clock.fill", count: state.ready, label: "Bereit", color: SporttagColors.ready)
                CountTile(symbol: "checkmark.circle.fill", count: state.done, label: "Fertig", color: SporttagColors.done)
            }

            TopIssueRow(state: state)
        }
        .padding(16)
    }
}

/// Alle Stationen als ein Balken, Segmentbreite = Anteil je Status.
private struct StationStatusBar: View {
    let state: EventHealthActivityAttributes.ContentState

    private var segments: [(count: Int, color: Color)] {
        [
            (state.attention, SporttagColors.danger),
            (state.running, SporttagColors.running),
            (state.ready, SporttagColors.ready),
            (state.done, SporttagColors.done),
            (state.other, SporttagColors.subtle.opacity(0.35)),
        ].filter { $0.count > 0 }
    }

    var body: some View {
        let visible = segments
        let total = max(visible.reduce(0) { $0 + $1.count }, 1)
        GeometryReader { geo in
            let spacing: CGFloat = 3
            let usable = geo.size.width - spacing * CGFloat(max(visible.count - 1, 0))
            HStack(spacing: spacing) {
                ForEach(Array(visible.enumerated()), id: \.offset) { _, segment in
                    Capsule()
                        .fill(segment.color)
                        .frame(width: max(6, usable * CGFloat(segment.count) / CGFloat(total)))
                }
            }
        }
        .frame(height: 8)
    }
}

private struct CountTile: View {
    let symbol: String
    let count: Int
    let label: String
    let color: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack(spacing: 4) {
                Image(systemName: symbol).font(.caption.bold())
                Text("\(count)").font(.title3.bold().monospacedDigit())
            }
            .foregroundStyle(count > 0 ? color : .white.opacity(0.3))
            Text(label)
                .font(.caption2.weight(.semibold))
                .foregroundStyle(.white.opacity(count > 0 ? 0.75 : 0.4))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct TopIssueRow: View {
    let state: EventHealthActivityAttributes.ContentState

    var body: some View {
        if let station = state.topIssue {
            HStack(spacing: 6) {
                Image(systemName: "exclamationmark.circle.fill")
                    .foregroundStyle(SporttagColors.danger)
                Text(station).bold().foregroundStyle(.white).lineLimit(1)
                if let reason = state.topIssueReason {
                    Text(reason).foregroundStyle(SporttagColors.danger).lineLimit(1)
                }
                Spacer(minLength: 0)
                if state.attention > 1 {
                    Text("+\(state.attention - 1)")
                        .font(.caption.bold())
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Capsule().fill(SporttagColors.danger.opacity(0.25)))
                        .foregroundStyle(SporttagColors.danger)
                }
            }
            .font(.footnote)
        } else {
            HStack(spacing: 6) {
                Image(systemName: "checkmark.seal.fill")
                Text("Alles im Plan").bold()
            }
            .font(.footnote)
            .foregroundStyle(SporttagColors.done)
        }
    }
}

private struct HealthHeadline: View {
    let state: EventHealthActivityAttributes.ContentState

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            if let round = state.roundLabel {
                Text(round).font(.caption2.bold()).foregroundStyle(.white.opacity(0.6))
            }
            if state.attention > 0 {
                Label("\(state.attention) \(state.attention == 1 ? "Problem" : "Probleme")", systemImage: "exclamationmark.triangle.fill")
                    .font(.subheadline.bold())
                    .foregroundStyle(SporttagColors.danger)
            } else {
                Label("\(state.running) läuft", systemImage: "play.fill")
                    .font(.subheadline.bold())
                    .foregroundStyle(SporttagColors.running)
            }
        }
    }
}

private struct StatusGlyph: View {
    let state: EventHealthActivityAttributes.ContentState

    var body: some View {
        Image(systemName: state.attention > 0 ? "exclamationmark.triangle.fill" : "checkmark.circle.fill")
            .foregroundStyle(state.attention > 0 ? SporttagColors.danger : SporttagColors.done)
    }
}

extension EventHealthActivityAttributes {
    fileprivate static var preview: EventHealthActivityAttributes {
        EventHealthActivityAttributes(eventName: "Demo-Sporttag", deepLinkUrl: "sporttag:///live")
    }
}

extension EventHealthActivityAttributes.ContentState {
    fileprivate static var trouble: EventHealthActivityAttributes.ContentState {
        EventHealthActivityAttributes.ContentState(
            attention: 3, running: 4, ready: 1, done: 2, other: 1,
            topIssue: "Station A – Wiese", topIssueReason: "Verspätet",
            roundLabel: "Runde 12 von 13", roundEndsAt: Date().addingTimeInterval(960)
        )
    }

    fileprivate static var healthy: EventHealthActivityAttributes.ContentState {
        EventHealthActivityAttributes.ContentState(
            attention: 0, running: 5, ready: 3, done: 2, other: 0,
            topIssue: nil, topIssueReason: nil,
            roundLabel: "Runde 4 von 13", roundEndsAt: Date().addingTimeInterval(420)
        )
    }
}

@available(iOS 17.0, *)
#Preview("Notification", as: .content, using: EventHealthActivityAttributes.preview) {
    EventHealthLiveActivity()
} contentStates: {
    EventHealthActivityAttributes.ContentState.trouble
    EventHealthActivityAttributes.ContentState.healthy
}

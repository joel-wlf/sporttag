import ActivityKit
import WidgetKit
import SwiftUI

/// Läuft parallel zur gleichnamigen Struktur in
/// modules/sporttag-live-activity/ios/SporttagLiveActivityModule.swift –
/// beide müssen exakt übereinstimmen, da App-Target und Widget-Extension
/// getrennt kompiliert werden.
struct MatchActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var teamsLabel: String
        var scoreLabel: String?
        var roundEndsAt: Date?
    }

    var gameName: String
    var matchId: String
    var deepLinkUrl: String
}

struct MatchLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: MatchActivityAttributes.self) { context in
            MatchLockScreenView(attributes: context.attributes, state: context.state)
                .activityBackgroundTint(Color(red: 0.11, green: 0.15, blue: 0.11))
                .activitySystemActionForegroundColor(Color.white)
                .widgetURL(URL(string: context.attributes.deepLinkUrl))
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("LÄUFT").font(.system(size: 10, weight: .black))
                        Text(context.attributes.gameName).font(.caption).lineLimit(1)
                    }
                }
                DynamicIslandExpandedRegion(.trailing) {
                    if let score = context.state.scoreLabel {
                        Text(score).font(.title3.bold())
                    } else if let ends = context.state.roundEndsAt {
                        Text(timerInterval: Date()...ends, countsDown: true)
                            .font(.caption.monospacedDigit())
                            .frame(width: 44)
                    }
                }
                DynamicIslandExpandedRegion(.bottom) {
                    Text(context.state.teamsLabel).font(.subheadline.bold()).lineLimit(1)
                }
            } compactLeading: {
                Text("🏃").font(.caption)
            } compactTrailing: {
                Text(context.state.scoreLabel ?? "läuft").font(.caption2.bold())
            } minimal: {
                Text("🏃")
            }
            .widgetURL(URL(string: context.attributes.deepLinkUrl))
        }
    }
}

private struct MatchLockScreenView: View {
    let attributes: MatchActivityAttributes
    let state: MatchActivityAttributes.ContentState

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text("LÄUFT")
                    .font(.system(size: 11, weight: .black))
                    .foregroundStyle(.white.opacity(0.7))
                Spacer()
                if let ends = state.roundEndsAt {
                    Text(timerInterval: Date()...ends, countsDown: true)
                        .font(.caption.monospacedDigit())
                        .foregroundStyle(.white.opacity(0.85))
                }
            }
            Text(state.teamsLabel)
                .font(.title3.bold())
                .foregroundStyle(.white)
                .lineLimit(1)
            HStack {
                Text(attributes.gameName)
                    .font(.footnote)
                    .foregroundStyle(.white.opacity(0.7))
                Spacer()
                if let score = state.scoreLabel {
                    Text(score)
                        .font(.title2.bold())
                        .foregroundStyle(.white)
                }
            }
        }
        .padding(16)
    }
}

extension MatchActivityAttributes {
    fileprivate static var preview: MatchActivityAttributes {
        MatchActivityAttributes(gameName: "Sackhüpfen", matchId: "preview", deepLinkUrl: "sporttag:///live")
    }
}

extension MatchActivityAttributes.ContentState {
    fileprivate static var running: MatchActivityAttributes.ContentState {
        MatchActivityAttributes.ContentState(teamsLabel: "Rot – Blau", scoreLabel: "12:8", roundEndsAt: Date().addingTimeInterval(420))
    }
}

#Preview("Notification", as: .content, using: MatchActivityAttributes.preview) {
    MatchLiveActivity()
} contentStates: {
    MatchActivityAttributes.ContentState.running
}

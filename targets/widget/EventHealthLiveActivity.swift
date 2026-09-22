import ActivityKit
import WidgetKit
import SwiftUI

/// Läuft parallel zur gleichnamigen Struktur in
/// modules/sporttag-live-activity/ios/SporttagLiveActivityModule.swift –
/// beide müssen exakt übereinstimmen, da App-Target und Widget-Extension
/// getrennt kompiliert werden.
struct EventHealthActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var summary: String
        var attentionCount: Int
        var roundEndsAt: Date?
    }

    var eventName: String
    var deepLinkUrl: String
}

struct EventHealthLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: EventHealthActivityAttributes.self) { context in
            EventHealthLockScreenView(attributes: context.attributes, state: context.state)
                .activityBackgroundTint(Color(red: 0.11, green: 0.15, blue: 0.11))
                .activitySystemActionForegroundColor(Color.white)
                .widgetURL(URL(string: context.attributes.deepLinkUrl))
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Text(context.attributes.eventName).font(.caption).lineLimit(1)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    if context.state.attentionCount > 0 {
                        Text("\(context.state.attentionCount)!").font(.title3.bold()).foregroundStyle(.red)
                    } else if let ends = context.state.roundEndsAt {
                        Text(timerInterval: Date()...ends, countsDown: true)
                            .font(.caption.monospacedDigit())
                            .frame(width: 44)
                    }
                }
                DynamicIslandExpandedRegion(.bottom) {
                    Text(context.state.summary).font(.footnote).lineLimit(2)
                }
            } compactLeading: {
                Text("📋").font(.caption)
            } compactTrailing: {
                if context.state.attentionCount > 0 {
                    Text("\(context.state.attentionCount)!").font(.caption2.bold()).foregroundStyle(.red)
                } else {
                    Text("ok").font(.caption2.bold())
                }
            } minimal: {
                Text("📋")
            }
            .widgetURL(URL(string: context.attributes.deepLinkUrl))
        }
    }
}

private struct EventHealthLockScreenView: View {
    let attributes: EventHealthActivityAttributes
    let state: EventHealthActivityAttributes.ContentState

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(attributes.eventName.uppercased())
                    .font(.system(size: 11, weight: .black))
                    .foregroundStyle(.white.opacity(0.7))
                Spacer()
                if let ends = state.roundEndsAt {
                    Text(timerInterval: Date()...ends, countsDown: true)
                        .font(.caption.monospacedDigit())
                        .foregroundStyle(.white.opacity(0.85))
                }
            }
            Text(state.summary)
                .font(.title3.bold())
                .foregroundStyle(.white)
                .lineLimit(2)
        }
        .padding(16)
    }
}

extension EventHealthActivityAttributes {
    fileprivate static var preview: EventHealthActivityAttributes {
        EventHealthActivityAttributes(eventName: "Sporttag 2026", deepLinkUrl: "sporttag:///live")
    }
}

extension EventHealthActivityAttributes.ContentState {
    fileprivate static var healthy: EventHealthActivityAttributes.ContentState {
        EventHealthActivityAttributes.ContentState(summary: "5 läuft · 3 bereit · 2 fertig", attentionCount: 0, roundEndsAt: Date().addingTimeInterval(420))
    }
}

#Preview("Notification", as: .content, using: EventHealthActivityAttributes.preview) {
    EventHealthLiveActivity()
} contentStates: {
    EventHealthActivityAttributes.ContentState.healthy
}

import ExpoModulesCore
import ActivityKit

// MUSS exakt mit MatchActivityAttributes in
// targets/widget/MatchLiveActivity.swift übereinstimmen (getrennt kompilierte Targets).
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

// MUSS exakt mit EventHealthActivityAttributes in
// targets/widget/EventHealthLiveActivity.swift übereinstimmen.
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

struct EventHealthStateRecord: Record {
    @Field var attention: Int = 0
    @Field var running: Int = 0
    @Field var ready: Int = 0
    @Field var done: Int = 0
    @Field var other: Int = 0
    @Field var topIssue: String? = nil
    @Field var topIssueReason: String? = nil
    @Field var roundLabel: String? = nil
    @Field var roundEndsAtMs: Double? = nil

    var contentState: EventHealthActivityAttributes.ContentState {
        EventHealthActivityAttributes.ContentState(
            attention: attention, running: running, ready: ready, done: done, other: other,
            topIssue: topIssue, topIssueReason: topIssueReason,
            roundLabel: roundLabel, roundEndsAt: dateFrom(roundEndsAtMs)
        )
    }
}

private func dateFrom(_ ms: Double?) -> Date? {
    guard let ms else { return nil }
    return Date(timeIntervalSince1970: ms / 1000)
}

public class SporttagLiveActivityModule: Module {
    public func definition() -> ModuleDefinition {
        Name("SporttagLiveActivity")

        Function("areActivitiesEnabled") { () -> Bool in
            if #available(iOS 16.2, *) {
                return ActivityAuthorizationInfo().areActivitiesEnabled
            }
            return false
        }

        // MARK: Match activity (Cockpit)

        Function("startMatchActivity") { (gameName: String, matchId: String, deepLinkUrl: String, teamsLabel: String, scoreLabel: String?, roundEndsAtMs: Double?) -> Bool in
            guard #available(iOS 16.2, *) else { return false }
            // Nur eine Match-Aktivität gleichzeitig: eine evtl. laufende zuerst beenden.
            Task {
                for activity in Activity<MatchActivityAttributes>.activities {
                    await activity.end(nil, dismissalPolicy: .immediate)
                }
            }
            let attributes = MatchActivityAttributes(gameName: gameName, matchId: matchId, deepLinkUrl: deepLinkUrl)
            let state = MatchActivityAttributes.ContentState(teamsLabel: teamsLabel, scoreLabel: scoreLabel, roundEndsAt: dateFrom(roundEndsAtMs))
            do {
                _ = try Activity.request(attributes: attributes, content: ActivityContent(state: state, staleDate: nil))
                return true
            } catch {
                return false
            }
        }

        Function("updateMatchActivity") { (teamsLabel: String, scoreLabel: String?, roundEndsAtMs: Double?) -> Void in
            guard #available(iOS 16.2, *) else { return }
            let state = MatchActivityAttributes.ContentState(teamsLabel: teamsLabel, scoreLabel: scoreLabel, roundEndsAt: dateFrom(roundEndsAtMs))
            Task {
                for activity in Activity<MatchActivityAttributes>.activities {
                    await activity.update(ActivityContent(state: state, staleDate: nil))
                }
            }
        }

        Function("endMatchActivity") { () -> Void in
            guard #available(iOS 16.2, *) else { return }
            Task {
                for activity in Activity<MatchActivityAttributes>.activities {
                    await activity.end(nil, dismissalPolicy: .immediate)
                }
            }
        }

        // MARK: Event health activity (Backoffice)

        Function("startEventHealthActivity") { (eventName: String, deepLinkUrl: String, record: EventHealthStateRecord) -> Bool in
            guard #available(iOS 16.2, *) else { return false }
            Task {
                for activity in Activity<EventHealthActivityAttributes>.activities {
                    await activity.end(nil, dismissalPolicy: .immediate)
                }
            }
            let attributes = EventHealthActivityAttributes(eventName: eventName, deepLinkUrl: deepLinkUrl)
            let state = record.contentState
            do {
                _ = try Activity.request(attributes: attributes, content: ActivityContent(state: state, staleDate: nil))
                return true
            } catch {
                return false
            }
        }

        Function("updateEventHealthActivity") { (record: EventHealthStateRecord) -> Void in
            guard #available(iOS 16.2, *) else { return }
            let state = record.contentState
            Task {
                for activity in Activity<EventHealthActivityAttributes>.activities {
                    await activity.update(ActivityContent(state: state, staleDate: nil))
                }
            }
        }

        Function("endEventHealthActivity") { () -> Void in
            guard #available(iOS 16.2, *) else { return }
            Task {
                for activity in Activity<EventHealthActivityAttributes>.activities {
                    await activity.end(nil, dismissalPolicy: .immediate)
                }
            }
        }

        // Nutzer können die Aktivität vom Sperrbildschirm wegwischen; das erfährt JS sonst nicht.
        Function("isEventHealthActivityRunning") { () -> Bool in
            guard #available(iOS 16.2, *) else { return false }
            return Activity<EventHealthActivityAttributes>.activities.contains { $0.activityState == .active }
        }
    }
}

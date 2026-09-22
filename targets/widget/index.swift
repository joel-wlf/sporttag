import WidgetKit
import SwiftUI

@main
struct SporttagWidgetBundle: WidgetBundle {
    var body: some Widget {
        MatchLiveActivity()
        EventHealthLiveActivity()
    }
}

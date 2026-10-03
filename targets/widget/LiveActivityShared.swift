import SwiftUI

/// Dunkle Theme-Tokens aus components/ui/theme.ts – die Live Activity liegt
/// immer auf dunklem Oliv, daher die Dark-Varianten.
enum SporttagColors {
    static let background = Color(red: 0.11, green: 0.15, blue: 0.11)
    static let danger = Color(red: 1.0, green: 0.569, blue: 0.533)      // #FF9188
    static let running = Color(red: 0.663, green: 0.710, blue: 0.541)   // #A9B58A
    static let ready = Color(red: 0.835, green: 0.686, blue: 0.404)     // #D5AF67
    static let done = Color(red: 0.612, green: 0.812, blue: 0.561)      // #9CCF8F
    static let subtle = Color(red: 0.722, green: 0.737, blue: 0.678)    // #B8BCAD
}

/// `Text(timerInterval:)` stürzt ab, wenn das Ende schon vorbei ist, und
/// beansprucht sonst die volle Breite – daher feste, rechtsbündige Breite.
struct CountdownText: View {
    let ends: Date
    var width: CGFloat = 64

    var body: some View {
        Group {
            if ends > Date() {
                Text(timerInterval: Date()...ends, countsDown: true)
                    .monospacedDigit()
            } else {
                Text("Zeit um")
            }
        }
        .multilineTextAlignment(.trailing)
        .frame(width: width, alignment: .trailing)
    }
}

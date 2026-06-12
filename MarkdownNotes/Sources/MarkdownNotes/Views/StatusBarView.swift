import SwiftUI

struct StatusBarView: View {
    let content: String

    private var stats: TextStatistics {
        TextStatistics(from: content)
    }

    var body: some View {
        HStack(spacing: 16) {
            Text("\(stats.wordCount) words")
            Text("\(stats.characterCount) characters")
            Text("\(stats.lineCount) lines")
            Spacer()
        }
        .font(.system(size: 11))
        .foregroundStyle(.secondary)
        .padding(.horizontal, 12)
        .padding(.vertical, 4)
        .overlay(alignment: .top) {
            Divider()
        }
    }
}

import Foundation

struct TextStatistics {
    let wordCount: Int
    let characterCount: Int
    let lineCount: Int

    init(from text: String) {
        characterCount = text.count

        if text.isEmpty {
            wordCount = 0
            lineCount = 0
            return
        }

        // Word count: split by whitespace and newlines, filter empty components
        let words = text.split(omittingEmptySubsequences: true) { $0.isWhitespace }
        wordCount = words.count

        // Line count: number of newline characters + 1
        // "hello" = 1, "a\nb" = 2, "hello\n" = 2
        let newlineCount = text.filter { $0.isNewline }.count
        lineCount = newlineCount + 1
    }
}

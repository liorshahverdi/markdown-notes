import XCTest
@testable import MarkdownNotes

final class TextStatisticsTests: XCTestCase {

    // MARK: - Empty string

    func testEmptyString() {
        let stats = TextStatistics(from: "")
        XCTAssertEqual(stats.wordCount, 0)
        XCTAssertEqual(stats.characterCount, 0)
        XCTAssertEqual(stats.lineCount, 0)
    }

    // MARK: - Single word

    func testSingleWord() {
        let stats = TextStatistics(from: "hello")
        XCTAssertEqual(stats.wordCount, 1)
        XCTAssertEqual(stats.characterCount, 5)
        XCTAssertEqual(stats.lineCount, 1)
    }

    // MARK: - Multi-word single line

    func testMultiWordSingleLine() {
        let stats = TextStatistics(from: "hello world foo")
        XCTAssertEqual(stats.wordCount, 3)
        XCTAssertEqual(stats.characterCount, 15)
        XCTAssertEqual(stats.lineCount, 1)
    }

    // MARK: - Multi-line text

    func testMultiLineText() {
        let stats = TextStatistics(from: "line one\nline two\nline three")
        XCTAssertEqual(stats.wordCount, 6)
        XCTAssertEqual(stats.characterCount, 28)
        XCTAssertEqual(stats.lineCount, 3)
    }

    func testTwoLines() {
        let stats = TextStatistics(from: "a\nb")
        XCTAssertEqual(stats.wordCount, 2)
        XCTAssertEqual(stats.characterCount, 3)
        XCTAssertEqual(stats.lineCount, 2)
    }

    // MARK: - Whitespace-only

    func testWhitespaceOnly() {
        let stats = TextStatistics(from: "   ")
        XCTAssertEqual(stats.wordCount, 0)
        XCTAssertEqual(stats.characterCount, 3)
        XCTAssertEqual(stats.lineCount, 1)
    }

    func testWhitespaceWithNewlines() {
        let stats = TextStatistics(from: " \n \n ")
        XCTAssertEqual(stats.wordCount, 0)
        XCTAssertEqual(stats.characterCount, 5)
        XCTAssertEqual(stats.lineCount, 3)
    }

    // MARK: - Multiple consecutive spaces

    func testMultipleSpacesBetweenWords() {
        let stats = TextStatistics(from: "hello    world")
        XCTAssertEqual(stats.wordCount, 2)
        XCTAssertEqual(stats.characterCount, 14)
        XCTAssertEqual(stats.lineCount, 1)
    }

    // MARK: - Longer text (paragraph)

    func testParagraph() {
        let text = "Swift is a powerful and intuitive programming language.\nIt is used for iOS, macOS, and more.\nSwift makes coding fun."
        let stats = TextStatistics(from: text)
        XCTAssertEqual(stats.wordCount, 20)
        XCTAssertEqual(stats.characterCount, text.count)
        XCTAssertEqual(stats.lineCount, 3)
    }

    // MARK: - Trailing newline

    func testTrailingNewline() {
        let stats = TextStatistics(from: "hello\n")
        XCTAssertEqual(stats.wordCount, 1)
        XCTAssertEqual(stats.characterCount, 6)
        XCTAssertEqual(stats.lineCount, 2)
    }

    // MARK: - Tabs and mixed whitespace

    func testTabsAsWhitespace() {
        let stats = TextStatistics(from: "word1\tword2")
        XCTAssertEqual(stats.wordCount, 2)
        XCTAssertEqual(stats.characterCount, 11)
        XCTAssertEqual(stats.lineCount, 1)
    }

    // MARK: - Performance

    func testPerformanceLargeString() {
        let word = "hello "
        let largeText = String(repeating: word, count: 16_667) // ~100K chars
        measure {
            _ = TextStatistics(from: largeText)
        }
    }
}

import XCTest
import AppKit
@testable import MarkdownNotes

final class MarkdownHighlighterTests: XCTestCase {

    // MARK: - Helper

    private func attributes(
        of text: String,
        at location: Int
    ) -> [NSAttributedString.Key: Any] {
        let attributed = MarkdownHighlighter.highlight(text)
        return attributed.attributes(at: location, effectiveRange: nil)
    }

    private var baseFont: NSFont {
        NSFont.monospacedSystemFont(ofSize: 14, weight: .regular)
    }

    private var boldFont: NSFont {
        NSFont.monospacedSystemFont(ofSize: 14, weight: .bold)
    }

    // MARK: - Plain text

    func testPlainTextGetsDefaultFont() {
        let text = "Hello world"
        let attrs = attributes(of: text, at: 0)
        let font = attrs[.font] as? NSFont
        XCTAssertEqual(font, baseFont)
        let color = attrs[.foregroundColor] as? NSColor
        XCTAssertEqual(color, NSColor.textColor)
    }

    // MARK: - Headings

    func testH1HeadingIsBoldAndBlue() {
        let text = "# Heading One"
        let attrs = attributes(of: text, at: 2) // the 'H' in Heading
        let font = attrs[.font] as? NSFont
        XCTAssertNotNil(font)
        XCTAssertTrue(font!.fontDescriptor.symbolicTraits.contains(.bold))
        let color = attrs[.foregroundColor] as? NSColor
        XCTAssertEqual(color, NSColor.systemBlue)
    }

    func testH2HeadingIsBoldAndBlue() {
        let text = "## Sub Heading"
        let attrs = attributes(of: text, at: 3) // the 'S' in Sub
        let font = attrs[.font] as? NSFont
        XCTAssertNotNil(font)
        XCTAssertTrue(font!.fontDescriptor.symbolicTraits.contains(.bold))
        let color = attrs[.foregroundColor] as? NSColor
        XCTAssertEqual(color, NSColor.systemBlue)
    }

    func testH3HeadingIsBoldAndBlue() {
        let text = "### Third Level"
        let attrs = attributes(of: text, at: 4) // the 'T' in Third
        let font = attrs[.font] as? NSFont
        XCTAssertNotNil(font)
        XCTAssertTrue(font!.fontDescriptor.symbolicTraits.contains(.bold))
        let color = attrs[.foregroundColor] as? NSColor
        XCTAssertEqual(color, NSColor.systemBlue)
    }

    func testHeadingHashIsAlsoBoldAndBlue() {
        let text = "# Heading"
        let attrs = attributes(of: text, at: 0) // the '#'
        let color = attrs[.foregroundColor] as? NSColor
        XCTAssertEqual(color, NSColor.systemBlue)
    }

    // MARK: - Bold

    func testBoldTextIsBold() {
        let text = "some **bold** text"
        // "**bold**" starts at index 5
        // The text "bold" is at indices 7..10
        let attrs = attributes(of: text, at: 7) // 'b' in bold
        let font = attrs[.font] as? NSFont
        XCTAssertNotNil(font)
        XCTAssertTrue(font!.fontDescriptor.symbolicTraits.contains(.bold))
    }

    func testBoldMarkersAreDimmedGray() {
        let text = "some **bold** text"
        // First ** starts at index 5
        let attrs = attributes(of: text, at: 5) // first '*'
        let color = attrs[.foregroundColor] as? NSColor
        XCTAssertEqual(color, NSColor.systemGray)
    }

    // MARK: - Italic

    func testItalicWithUnderscores() {
        let text = "some _italic_ text"
        // "_italic_" starts at index 5
        // "italic" is at indices 6..11
        let attrs = attributes(of: text, at: 6) // 'i' in italic
        let font = attrs[.font] as? NSFont
        XCTAssertNotNil(font)
        XCTAssertTrue(font!.fontDescriptor.symbolicTraits.contains(.italic))
    }

    func testItalicWithAsterisks() {
        let text = "some *italic* text"
        let attrs = attributes(of: text, at: 6) // 'i' in italic
        let font = attrs[.font] as? NSFont
        XCTAssertNotNil(font)
        XCTAssertTrue(font!.fontDescriptor.symbolicTraits.contains(.italic))
    }

    func testItalicMarkersAreDimmedGray() {
        let text = "some _italic_ text"
        let attrs = attributes(of: text, at: 5) // the '_'
        let color = attrs[.foregroundColor] as? NSColor
        XCTAssertEqual(color, NSColor.systemGray)
    }

    // MARK: - Inline code

    func testInlineCodeHasBackgroundColor() {
        let text = "some `code` here"
        // "`code`" starts at index 5
        // "code" is at indices 6..9
        let attrs = attributes(of: text, at: 6) // 'c' in code
        let bgColor = attrs[.backgroundColor] as? NSColor
        XCTAssertNotNil(bgColor, "Inline code should have a background color")
    }

    func testInlineCodeUsesMonospaceFont() {
        let text = "some `code` here"
        let attrs = attributes(of: text, at: 6)
        let font = attrs[.font] as? NSFont
        XCTAssertNotNil(font)
        // Should still be monospace (base font is already monospace)
        XCTAssertTrue(font!.fontName.lowercased().contains("mono") ||
                      font!.familyName?.lowercased().contains("mono") == true)
    }

    // MARK: - Links

    func testLinkTextHasLinkColor() {
        let text = "click [here](https://example.com) now"
        // "[here]" starts at index 6
        // "here" is at indices 7..10
        let attrs = attributes(of: text, at: 7) // 'h' in here
        let color = attrs[.foregroundColor] as? NSColor
        XCTAssertEqual(color, NSColor.linkColor)
    }

    // MARK: - Code block fences

    func testCodeBlockFencesAreDimmedGray() {
        let text = "```\nsome code\n```"
        let attrs = attributes(of: text, at: 0) // first '`'
        let color = attrs[.foregroundColor] as? NSColor
        XCTAssertEqual(color, NSColor.systemGray)
    }

    // MARK: - Mixed content

    func testMixedContentPreservesPlainText() {
        let text = "Hello **world** and `code`"
        // "Hello " is at 0..5
        let attrs = attributes(of: text, at: 0) // 'H' in Hello
        let font = attrs[.font] as? NSFont
        XCTAssertEqual(font, baseFont)
        let color = attrs[.foregroundColor] as? NSColor
        XCTAssertEqual(color, NSColor.textColor)
    }

    func testEmptyStringReturnsEmptyAttributedString() {
        let result = MarkdownHighlighter.highlight("")
        XCTAssertEqual(result.length, 0)
    }

    // MARK: - Multiline headings

    func testOnlyLineStartingWithHashIsHeading() {
        let text = "normal\n## heading\nmore"
        // "## heading" starts at index 7
        // "heading" starts at index 10
        let normalAttrs = attributes(of: text, at: 0)
        let normalColor = normalAttrs[.foregroundColor] as? NSColor
        XCTAssertEqual(normalColor, NSColor.textColor)

        let headingAttrs = attributes(of: text, at: 10)
        let headingColor = headingAttrs[.foregroundColor] as? NSColor
        XCTAssertEqual(headingColor, NSColor.systemBlue)
    }
}

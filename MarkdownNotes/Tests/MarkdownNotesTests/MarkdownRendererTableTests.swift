import XCTest
@testable import MarkdownNotes

final class MarkdownRendererTableTests: XCTestCase {

    // Helper to extract just the body content from full HTML
    private func bodyContent(_ markdown: String) -> String {
        let html = MarkdownRenderer.renderHTML(from: markdown)
        guard let bodyStart = html.range(of: "<body>"),
              let bodyEnd = html.range(of: "</body>") else {
            return html
        }
        return String(html[bodyStart.upperBound..<bodyEnd.lowerBound])
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    // MARK: - AC1: Basic table structure

    func testBasicTableRendersCorrectStructure() {
        let md = """
        | Header 1 | Header 2 |
        |---|---|
        | data1 | data2 |
        """
        let body = bodyContent(md)
        XCTAssertTrue(body.contains("<table>"), "Should contain <table> tag")
        XCTAssertTrue(body.contains("<thead>"), "Should contain <thead> tag")
        XCTAssertTrue(body.contains("<tbody>"), "Should contain <tbody> tag")
        XCTAssertTrue(body.contains("<th>Header 1</th>"), "Should contain header 1")
        XCTAssertTrue(body.contains("<th>Header 2</th>"), "Should contain header 2")
        XCTAssertTrue(body.contains("<td>data1</td>"), "Should contain data1")
        XCTAssertTrue(body.contains("<td>data2</td>"), "Should contain data2")
        XCTAssertTrue(body.contains("</thead>"), "Should close thead")
        XCTAssertTrue(body.contains("</tbody>"), "Should close tbody")
        XCTAssertTrue(body.contains("</table>"), "Should close table")
    }

    func testMultipleDataRows() {
        let md = """
        | A | B |
        |---|---|
        | 1 | 2 |
        | 3 | 4 |
        """
        let body = bodyContent(md)
        XCTAssertTrue(body.contains("<td>1</td>"), "Row 1 col 1")
        XCTAssertTrue(body.contains("<td>2</td>"), "Row 1 col 2")
        XCTAssertTrue(body.contains("<td>3</td>"), "Row 2 col 1")
        XCTAssertTrue(body.contains("<td>4</td>"), "Row 2 col 2")
    }

    // MARK: - AC2: Alignment markers

    func testLeftAlignment() {
        let md = """
        | Name |
        |:---|
        | Alice |
        """
        let body = bodyContent(md)
        XCTAssertTrue(body.contains("style=\"text-align:left\""), "Should have left alignment")
        XCTAssertTrue(body.contains("<th style=\"text-align:left\">Name</th>"), "Header should be left-aligned")
        XCTAssertTrue(body.contains("<td style=\"text-align:left\">Alice</td>"), "Data should be left-aligned")
    }

    func testCenterAlignment() {
        let md = """
        | Name |
        |:---:|
        | Alice |
        """
        let body = bodyContent(md)
        XCTAssertTrue(body.contains("style=\"text-align:center\""), "Should have center alignment")
    }

    func testRightAlignment() {
        let md = """
        | Price |
        |---:|
        | $10 |
        """
        let body = bodyContent(md)
        XCTAssertTrue(body.contains("style=\"text-align:right\""), "Should have right alignment")
    }

    func testMixedAlignment() {
        let md = """
        | Left | Center | Right |
        |:---|:---:|---:|
        | a | b | c |
        """
        let body = bodyContent(md)
        XCTAssertTrue(body.contains("<th style=\"text-align:left\">Left</th>"), "Left header")
        XCTAssertTrue(body.contains("<th style=\"text-align:center\">Center</th>"), "Center header")
        XCTAssertTrue(body.contains("<th style=\"text-align:right\">Right</th>"), "Right header")
        XCTAssertTrue(body.contains("<td style=\"text-align:left\">a</td>"), "Left data")
        XCTAssertTrue(body.contains("<td style=\"text-align:center\">b</td>"), "Center data")
        XCTAssertTrue(body.contains("<td style=\"text-align:right\">c</td>"), "Right data")
    }

    // MARK: - AC3: Inline formatting in cells

    func testInlineFormattingInCells() {
        let md = """
        | Header |
        |---|
        | **bold** |
        """
        let body = bodyContent(md)
        XCTAssertTrue(body.contains("<td><strong>bold</strong></td>"), "Should render bold in cells")
    }

    func testInlineCodeInCells() {
        let md = """
        | Header |
        |---|
        | `code` |
        """
        let body = bodyContent(md)
        XCTAssertTrue(body.contains("<td><code>code</code></td>"), "Should render code in cells")
    }

    func testLinkInCells() {
        let md = """
        | Header |
        |---|
        | [link](http://example.com) |
        """
        let body = bodyContent(md)
        XCTAssertTrue(body.contains("<a href=\"http://example.com\">link</a>"), "Should render links in cells")
    }

    // MARK: - AC4: Tables with no alignment row still render

    func testSeparatorWithoutAlignmentMarkers() {
        let md = """
        | A | B |
        |---|---|
        | 1 | 2 |
        """
        let body = bodyContent(md)
        // No alignment style should be added
        XCTAssertTrue(body.contains("<th>A</th>"), "Header without alignment")
        XCTAssertTrue(body.contains("<td>1</td>"), "Data without alignment")
    }

    // MARK: - AC5: Content before and after table

    func testContentBeforeAndAfterTable() {
        let md = """
        # Title
        | A |
        |---|
        | 1 |
        Some text after
        """
        let body = bodyContent(md)
        XCTAssertTrue(body.contains("<h1>Title</h1>"), "Title before table")
        XCTAssertTrue(body.contains("<table>"), "Table present")
        XCTAssertTrue(body.contains("</table>"), "Table closed")
        XCTAssertTrue(body.contains("Some text after"), "Text after table")
    }

    // MARK: - AC6: Empty cells

    func testEmptyCells() {
        let md = """
        | A | B |
        |---|---|
        | | data |
        """
        let body = bodyContent(md)
        XCTAssertTrue(body.contains("<td></td>"), "Should handle empty cell")
        XCTAssertTrue(body.contains("<td>data</td>"), "Should handle non-empty cell next to empty")
    }

    // MARK: - AC7: Leading/trailing pipes optional

    func testOptionalLeadingTrailingPipes() {
        let md = """
        Header 1 | Header 2
        ---|---
        data1 | data2
        """
        let body = bodyContent(md)
        XCTAssertTrue(body.contains("<table>"), "Should detect table without pipes")
        XCTAssertTrue(body.contains("<th>Header 1</th>"), "Header 1 without leading pipe")
        XCTAssertTrue(body.contains("<th>Header 2</th>"), "Header 2 without trailing pipe")
        XCTAssertTrue(body.contains("<td>data1</td>"), "Data without pipes")
    }

    // MARK: - CSS

    func testTableCSSPresent() {
        let html = MarkdownRenderer.renderHTML(from: "| A |\n|---|\n| B |")
        XCTAssertTrue(html.contains("table"), "CSS should reference table")
        XCTAssertTrue(html.contains("border"), "CSS should style borders")
    }
}

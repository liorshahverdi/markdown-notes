import XCTest
@testable import MarkdownNotes

final class PlaceholderTests: XCTestCase {
    func testMarkdownRendererExists() {
        let html = MarkdownRenderer.renderHTML(from: "# Hello")
        XCTAssertTrue(html.contains("<h1>"))
    }
}

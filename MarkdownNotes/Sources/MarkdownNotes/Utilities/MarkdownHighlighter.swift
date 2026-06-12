import AppKit

struct MarkdownHighlighter {

    static let fontSize: CGFloat = 14

    static var baseFont: NSFont {
        NSFont.monospacedSystemFont(ofSize: fontSize, weight: .regular)
    }

    static var boldFont: NSFont {
        NSFont.monospacedSystemFont(ofSize: fontSize, weight: .bold)
    }

    static var italicFont: NSFont {
        let descriptor = baseFont.fontDescriptor.withSymbolicTraits(.italic)
        return NSFont(descriptor: descriptor, size: fontSize) ?? baseFont
    }

    static var headingFont: NSFont {
        let descriptor = NSFont.monospacedSystemFont(ofSize: fontSize + 2, weight: .bold).fontDescriptor
        return NSFont(descriptor: descriptor, size: fontSize + 2)
            ?? NSFont.monospacedSystemFont(ofSize: fontSize + 2, weight: .bold)
    }

    static func highlight(_ text: String) -> NSAttributedString {
        let attributed = NSMutableAttributedString(string: text)
        let fullRange = NSRange(location: 0, length: attributed.length)

        guard attributed.length > 0 else {
            return attributed
        }

        // Base attributes: monospace font, default text color
        attributed.addAttributes([
            .font: baseFont,
            .foregroundColor: NSColor.textColor
        ], range: fullRange)

        // Apply patterns in order. Later patterns can override earlier ones
        // where ranges overlap.
        applyCodeBlockFences(to: attributed, text: text)
        applyHeadings(to: attributed, text: text)
        applyBold(to: attributed, text: text)
        applyItalic(to: attributed, text: text)
        applyInlineCode(to: attributed, text: text)
        applyLinks(to: attributed, text: text)

        return attributed
    }

    // MARK: - Headings (^#{1,3} .+)

    private static func applyHeadings(to attributed: NSMutableAttributedString, text: String) {
        guard let regex = try? NSRegularExpression(pattern: "^(#{1,3})\\s+(.+)$", options: .anchorsMatchLines) else { return }
        let fullRange = NSRange(location: 0, length: (text as NSString).length)
        regex.enumerateMatches(in: text, range: fullRange) { match, _, _ in
            guard let match else { return }
            let lineRange = match.range
            let boldDescriptor = baseFont.fontDescriptor.withSymbolicTraits(.bold)
            let headingFont = NSFont(descriptor: boldDescriptor, size: fontSize) ?? boldFont
            attributed.addAttributes([
                .font: headingFont,
                .foregroundColor: NSColor.systemBlue
            ], range: lineRange)
        }
    }

    // MARK: - Bold (**text**)

    private static func applyBold(to attributed: NSMutableAttributedString, text: String) {
        guard let regex = try? NSRegularExpression(pattern: "\\*\\*(.+?)\\*\\*", options: []) else { return }
        let fullRange = NSRange(location: 0, length: (text as NSString).length)
        regex.enumerateMatches(in: text, range: fullRange) { match, _, _ in
            guard let match else { return }
            let totalRange = match.range
            let innerRange = match.range(at: 1)

            // Markers: first **
            let openMarkerRange = NSRange(location: totalRange.location, length: 2)
            attributed.addAttribute(.foregroundColor, value: NSColor.systemGray, range: openMarkerRange)

            // Markers: last **
            let closeMarkerStart = totalRange.location + totalRange.length - 2
            let closeMarkerRange = NSRange(location: closeMarkerStart, length: 2)
            attributed.addAttribute(.foregroundColor, value: NSColor.systemGray, range: closeMarkerRange)

            // Bold content
            attributed.addAttribute(.font, value: boldFont, range: innerRange)
        }
    }

    // MARK: - Italic (*text* or _text_)
    // Use negative lookbehind/lookahead to avoid matching ** as italic

    private static func applyItalic(to attributed: NSMutableAttributedString, text: String) {
        // Match *text* but not **text**
        let patterns = [
            "(?<!\\*)\\*(?!\\*)(.+?)(?<!\\*)\\*(?!\\*)",  // *text*
            "(?<!_)_(?!_)(.+?)(?<!_)_(?!_)"               // _text_
        ]
        for pattern in patterns {
            guard let regex = try? NSRegularExpression(pattern: pattern, options: []) else { continue }
            let fullRange = NSRange(location: 0, length: (text as NSString).length)
            regex.enumerateMatches(in: text, range: fullRange) { match, _, _ in
                guard let match else { return }
                let totalRange = match.range
                let innerRange = match.range(at: 1)

                // Opening marker
                let openMarkerRange = NSRange(location: totalRange.location, length: 1)
                attributed.addAttribute(.foregroundColor, value: NSColor.systemGray, range: openMarkerRange)

                // Closing marker
                let closeMarkerStart = totalRange.location + totalRange.length - 1
                let closeMarkerRange = NSRange(location: closeMarkerStart, length: 1)
                attributed.addAttribute(.foregroundColor, value: NSColor.systemGray, range: closeMarkerRange)

                // Italic content
                attributed.addAttribute(.font, value: italicFont, range: innerRange)
            }
        }
    }

    // MARK: - Inline code (`code`)

    private static func applyInlineCode(to attributed: NSMutableAttributedString, text: String) {
        // Match `code` but not ```
        guard let regex = try? NSRegularExpression(pattern: "(?<!`)(`)((?!`).+?)(`)", options: []) else { return }
        let fullRange = NSRange(location: 0, length: (text as NSString).length)
        let codeBackground = NSColor.systemGray.withAlphaComponent(0.15)
        regex.enumerateMatches(in: text, range: fullRange) { match, _, _ in
            guard let match else { return }
            let totalRange = match.range

            attributed.addAttribute(.backgroundColor, value: codeBackground, range: totalRange)
            attributed.addAttribute(.font, value: baseFont, range: totalRange)
        }
    }

    // MARK: - Links [text](url)

    private static func applyLinks(to attributed: NSMutableAttributedString, text: String) {
        guard let regex = try? NSRegularExpression(pattern: "\\[(.+?)\\]\\((.+?)\\)", options: []) else { return }
        let fullRange = NSRange(location: 0, length: (text as NSString).length)
        regex.enumerateMatches(in: text, range: fullRange) { match, _, _ in
            guard let match else { return }
            let textRange = match.range(at: 1)
            attributed.addAttribute(.foregroundColor, value: NSColor.linkColor, range: textRange)
        }
    }

    // MARK: - Code block fences (```)

    private static func applyCodeBlockFences(to attributed: NSMutableAttributedString, text: String) {
        guard let regex = try? NSRegularExpression(pattern: "^```.*$", options: .anchorsMatchLines) else { return }
        let fullRange = NSRange(location: 0, length: (text as NSString).length)
        regex.enumerateMatches(in: text, range: fullRange) { match, _, _ in
            guard let match else { return }
            attributed.addAttribute(.foregroundColor, value: NSColor.systemGray, range: match.range)
        }
    }
}

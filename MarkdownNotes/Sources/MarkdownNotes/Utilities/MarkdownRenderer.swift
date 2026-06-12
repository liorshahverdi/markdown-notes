import Foundation

struct MarkdownRenderer {
    static func renderHTML(from markdown: String) -> String {
        var html = markdown

        // Escape HTML entities first
        html = html.replacingOccurrences(of: "&", with: "&amp;")
        html = html.replacingOccurrences(of: "<", with: "&lt;")
        html = html.replacingOccurrences(of: ">", with: "&gt;")

        // Process line by line for block elements
        let lines = html.components(separatedBy: "\n")
        var processedLines: [String] = []
        var inCodeBlock = false
        var inMermaidBlock = false
        var mermaidLines: [String] = []
        var inList = false
        var listType = ""
        var inTable = false
        var tableAlignments: [String?] = []
        var pendingTableHeaderLine: String? = nil

        for line in lines {
            var processed = line

            // Code blocks (including mermaid)
            if processed.hasPrefix("```") {
                if inMermaidBlock {
                    // Close mermaid block — use the original (un-escaped) source
                    let mermaidSource = mermaidLines.joined(separator: "\n")
                    processedLines.append("<pre class=\"mermaid\">\(mermaidSource)</pre>")
                    mermaidLines = []
                    inMermaidBlock = false
                    continue
                } else if inCodeBlock {
                    processedLines.append("</code></pre>")
                    inCodeBlock = false
                    continue
                } else {
                    // Check if this is a mermaid fence
                    let lang = String(processed.dropFirst(3)).trimmingCharacters(in: .whitespaces)
                    if lang.lowercased() == "mermaid" {
                        inMermaidBlock = true
                        continue
                    }
                    inCodeBlock = true
                    processedLines.append("<pre><code>")
                    continue
                }
            }

            if inMermaidBlock {
                // Store the raw line BEFORE HTML escaping was applied — reverse the escaping
                var raw = line
                raw = raw.replacingOccurrences(of: "&gt;", with: ">")
                raw = raw.replacingOccurrences(of: "&lt;", with: "<")
                raw = raw.replacingOccurrences(of: "&amp;", with: "&")
                mermaidLines.append(raw)
                continue
            }

            if inCodeBlock {
                processedLines.append(processed)
                continue
            }

            // Close list if line doesn't continue it
            let isUnorderedItem = processed.hasPrefix("- ") || processed.hasPrefix("* ")
            let isOrderedItem = processed.range(of: #"^\d+\. "#, options: .regularExpression) != nil
            let isCheckboxItem = processed.hasPrefix("- [x] ") || processed.hasPrefix("- [ ] ") ||
                                 processed.hasPrefix("- [X] ")

            if inList && !isUnorderedItem && !isOrderedItem && !isCheckboxItem {
                processedLines.append(listType == "ul" ? "</ul>" : "</ol>")
                inList = false
            }

            // Table handling
            let isTableRow = isTableLine(processed)
            let isSeparator = isTableSeparatorLine(processed)

            // If we have a pending header line, check if current line is a separator
            if let headerLine = pendingTableHeaderLine {
                if isSeparator {
                    // Start the table
                    tableAlignments = parseAlignments(processed)
                    let headerCells = parseTableCells(headerLine)
                    processedLines.append("<table>")
                    processedLines.append("<thead>")
                    processedLines.append("<tr>")
                    for (i, cell) in headerCells.enumerated() {
                        let align = i < tableAlignments.count ? tableAlignments[i] : nil
                        let style = align != nil ? " style=\"text-align:\(align!)\"" : ""
                        processedLines.append("<th\(style)>\(applyInlineFormatting(cell))</th>")
                    }
                    processedLines.append("</tr>")
                    processedLines.append("</thead>")
                    processedLines.append("<tbody>")
                    inTable = true
                    pendingTableHeaderLine = nil
                    continue
                } else {
                    // Not a table — flush pending line as paragraph
                    processedLines.append("<p>\(applyInlineFormatting(headerLine))</p>")
                    pendingTableHeaderLine = nil
                    // Fall through to process current line normally
                }
            }

            // If we're in a table
            if inTable {
                if isTableRow {
                    let cells = parseTableCells(processed)
                    processedLines.append("<tr>")
                    for (i, cell) in cells.enumerated() {
                        let align = i < tableAlignments.count ? tableAlignments[i] : nil
                        let style = align != nil ? " style=\"text-align:\(align!)\"" : ""
                        processedLines.append("<td\(style)>\(applyInlineFormatting(cell))</td>")
                    }
                    processedLines.append("</tr>")
                    continue
                } else {
                    // End the table
                    processedLines.append("</tbody>")
                    processedLines.append("</table>")
                    inTable = false
                    tableAlignments = []
                    // Fall through to process current line normally
                }
            }

            // If this looks like a table row and we're not in a table, buffer it
            if !inTable && isTableRow && !isSeparator {
                pendingTableHeaderLine = processed
                continue
            }

            // Headers
            if processed.hasPrefix("### ") {
                processed = "<h3>\(applyInlineFormatting(String(processed.dropFirst(4))))</h3>"
            } else if processed.hasPrefix("## ") {
                processed = "<h2>\(applyInlineFormatting(String(processed.dropFirst(3))))</h2>"
            } else if processed.hasPrefix("# ") {
                processed = "<h1>\(applyInlineFormatting(String(processed.dropFirst(2))))</h1>"
            }
            // Horizontal rule
            else if processed.trimmingCharacters(in: .whitespaces) == "---" ||
                        processed.trimmingCharacters(in: .whitespaces) == "***" {
                processed = "<hr>"
            }
            // Checkbox items
            else if isCheckboxItem {
                if !inList { processedLines.append("<ul class=\"checklist\">"); inList = true; listType = "ul" }
                let checked = processed.hasPrefix("- [x] ") || processed.hasPrefix("- [X] ")
                let text = String(processed.dropFirst(6))
                let checkbox = checked ? "&#9745;" : "&#9744;"
                processed = "<li>\(checkbox) \(applyInlineFormatting(text))</li>"
            }
            // Unordered list
            else if isUnorderedItem {
                if !inList { processedLines.append("<ul>"); inList = true; listType = "ul" }
                let text = String(processed.dropFirst(2))
                processed = "<li>\(applyInlineFormatting(text))</li>"
            }
            // Ordered list
            else if isOrderedItem {
                if !inList { processedLines.append("<ol>"); inList = true; listType = "ol" }
                if let dotIndex = processed.firstIndex(of: ".") {
                    let text = String(processed[processed.index(after: dotIndex)...]).trimmingCharacters(in: .whitespaces)
                    processed = "<li>\(applyInlineFormatting(text))</li>"
                }
            }
            // Blockquote
            else if processed.hasPrefix("&gt; ") {
                let text = String(processed.dropFirst(5))
                processed = "<blockquote>\(applyInlineFormatting(text))</blockquote>"
            }
            // Empty line
            else if processed.trimmingCharacters(in: .whitespaces).isEmpty {
                processed = "<br>"
            }
            // Paragraph
            else if !processed.hasPrefix("<h") {
                processed = "<p>\(applyInlineFormatting(processed))</p>"
            }

            processedLines.append(processed)
        }

        // Flush pending table header that was never followed by a separator
        if let headerLine = pendingTableHeaderLine {
            processedLines.append("<p>\(applyInlineFormatting(headerLine))</p>")
        }
        if inTable {
            processedLines.append("</tbody>")
            processedLines.append("</table>")
        }
        if inList {
            processedLines.append(listType == "ul" ? "</ul>" : "</ol>")
        }
        if inMermaidBlock {
            let mermaidSource = mermaidLines.joined(separator: "\n")
            processedLines.append("<pre class=\"mermaid\">\(mermaidSource)</pre>")
        }
        if inCodeBlock {
            processedLines.append("</code></pre>")
        }

        let body = processedLines.joined(separator: "\n")

        return """
        <!DOCTYPE html>
        <html>
        <head>
        <meta charset="utf-8">
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif;
                padding: 20px 24px;
                line-height: 1.6;
                color: #1d1d1f;
                background: #ffffff;
                max-width: 100%;
            }
            @media (prefers-color-scheme: dark) {
                body { background: #1e1e1e; color: #e0e0e0; }
                a { color: #6cb6ff; }
                code { background: #2d2d2d; }
                pre { background: #2d2d2d; }
                blockquote { border-color: #444; color: #aaa; }
                hr { border-color: #333; }
            }
            h1 { font-size: 1.8em; font-weight: 700; margin: 0.5em 0; }
            h2 { font-size: 1.4em; font-weight: 600; margin: 0.5em 0; }
            h3 { font-size: 1.2em; font-weight: 600; margin: 0.5em 0; }
            p { margin: 0.4em 0; }
            code {
                font-family: "SF Mono", Menlo, monospace;
                background: #f0f0f0;
                padding: 2px 6px;
                border-radius: 4px;
                font-size: 0.9em;
            }
            pre {
                background: #f0f0f0;
                padding: 12px 16px;
                border-radius: 8px;
                overflow-x: auto;
            }
            pre code { background: none; padding: 0; }
            blockquote {
                border-left: 3px solid #ccc;
                margin: 0.5em 0;
                padding: 0.2em 1em;
                color: #666;
            }
            ul, ol { padding-left: 1.5em; margin: 0.4em 0; }
            ul.checklist { list-style: none; padding-left: 0.5em; }
            li { margin: 0.2em 0; }
            hr { border: none; border-top: 1px solid #ddd; margin: 1em 0; }
            strong { font-weight: 600; }
            a { color: #0066cc; text-decoration: none; }
            a:hover { text-decoration: underline; }
            /* Table styling */
            table {
                border-collapse: collapse;
                margin: 0.5em 0;
                width: auto;
            }
            th, td {
                border: 1px solid #ddd;
                padding: 6px 12px;
            }
            th {
                background: #f6f6f6;
                font-weight: 600;
            }
            @media (prefers-color-scheme: dark) {
                th, td { border-color: #444; }
                th { background: #2a2a2a; }
            }
            /* Mermaid diagram styling */
            pre.mermaid {
                background: none;
                text-align: center;
                padding: 16px 0;
                overflow-x: auto;
            }
            pre.mermaid svg {
                max-width: 100%;
                height: auto;
            }
        </style>
        <script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>
        <script>
            mermaid.initialize({
                startOnLoad: true,
                theme: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'default',
                securityLevel: 'loose'
            });
        </script>
        </head>
        <body>
        \(body)
        </body>
        </html>
        """
    }

    private static func applyInlineFormatting(_ text: String) -> String {
        var result = text

        // Inline code (must come first to avoid processing inside code spans)
        result = applyRegex(result, pattern: "`([^`]+)`", replacement: "<code>$1</code>")

        // Bold + italic
        result = applyRegex(result, pattern: #"\*\*\*(.+?)\*\*\*"#, replacement: "<strong><em>$1</em></strong>")

        // Bold
        result = applyRegex(result, pattern: #"\*\*(.+?)\*\*"#, replacement: "<strong>$1</strong>")

        // Italic
        result = applyRegex(result, pattern: #"(?<!\w)_(.+?)_(?!\w)"#, replacement: "<em>$1</em>")
        result = applyRegex(result, pattern: #"\*(.+?)\*"#, replacement: "<em>$1</em>")

        // Strikethrough
        result = applyRegex(result, pattern: #"~~(.+?)~~"#, replacement: "<del>$1</del>")

        // Links
        result = applyRegex(result, pattern: #"\[([^\]]+)\]\(([^)]+)\)"#, replacement: #"<a href="$2">$1</a>"#)

        return result
    }

    private static func applyRegex(_ text: String, pattern: String, replacement: String) -> String {
        guard let regex = try? NSRegularExpression(pattern: pattern) else { return text }
        let range = NSRange(text.startIndex..., in: text)
        return regex.stringByReplacingMatches(in: text, range: range, withTemplate: replacement)
    }

    // MARK: - Table helpers

    /// Check if a line looks like a table row (contains at least one pipe)
    private static func isTableLine(_ line: String) -> Bool {
        let trimmed = line.trimmingCharacters(in: .whitespaces)
        return trimmed.contains("|")
    }

    /// Check if a line is a table separator row like `|---|---|` or `---|---`
    private static func isTableSeparatorLine(_ line: String) -> Bool {
        let trimmed = line.trimmingCharacters(in: .whitespaces)
        // Remove leading/trailing pipes and split by pipe
        let cells = splitTableRow(trimmed)
        guard !cells.isEmpty else { return false }
        // Each cell must match the pattern: optional colon, three or more dashes, optional colon
        for cell in cells {
            let c = cell.trimmingCharacters(in: .whitespaces)
            if c.isEmpty { continue }
            if c.range(of: #"^:?-{3,}:?$"#, options: .regularExpression) == nil {
                return false
            }
        }
        return true
    }

    /// Parse alignment from separator row cells
    private static func parseAlignments(_ line: String) -> [String?] {
        let trimmed = line.trimmingCharacters(in: .whitespaces)
        let cells = splitTableRow(trimmed)
        return cells.map { cell -> String? in
            let c = cell.trimmingCharacters(in: .whitespaces)
            if c.hasPrefix(":") && c.hasSuffix(":") { return "center" }
            if c.hasSuffix(":") { return "right" }
            if c.hasPrefix(":") { return "left" }
            return nil
        }
    }

    /// Parse table cells from a row, handling optional leading/trailing pipes
    private static func parseTableCells(_ line: String) -> [String] {
        return splitTableRow(line).map { $0.trimmingCharacters(in: .whitespaces) }
    }

    /// Split a table row by pipe, removing leading/trailing empty segments from pipes
    private static func splitTableRow(_ line: String) -> [String] {
        var trimmed = line.trimmingCharacters(in: .whitespaces)
        // Remove leading pipe
        if trimmed.hasPrefix("|") {
            trimmed = String(trimmed.dropFirst())
        }
        // Remove trailing pipe
        if trimmed.hasSuffix("|") {
            trimmed = String(trimmed.dropLast())
        }
        return trimmed.components(separatedBy: "|")
    }
}

import AppKit
import UniformTypeIdentifiers

struct TableCSVExporter {
    /// Extracts the first markdown table from the given markdown string and returns CSV text.
    static func csvString(from markdown: String) -> String? {
        let lines = markdown.components(separatedBy: "\n")

        // Find consecutive table lines (lines that start and end with |)
        var tableLines: [String] = []
        var foundTable = false

        for line in lines {
            let trimmed = line.trimmingCharacters(in: .whitespaces)
            if trimmed.hasPrefix("|") && trimmed.hasSuffix("|") {
                tableLines.append(trimmed)
                foundTable = true
            } else if foundTable {
                break // End of first table
            }
        }

        guard tableLines.count >= 2 else { return nil }

        // Filter out the separator row (contains only |, -, :, and spaces)
        let dataLines = tableLines.filter { line in
            let inner = line.dropFirst().dropLast() // Remove leading/trailing |
            let separatorChars = CharacterSet(charactersIn: "|- :")
            return !inner.unicodeScalars.allSatisfy { separatorChars.contains($0) }
        }

        guard !dataLines.isEmpty else { return nil }

        let csvRows = dataLines.map { line -> String in
            let inner = line.dropFirst().dropLast() // Remove leading/trailing |
            let cells = inner.components(separatedBy: "|").map { cell in
                let trimmed = cell.trimmingCharacters(in: .whitespaces)
                // Quote cells that contain commas, quotes, or newlines
                if trimmed.contains(",") || trimmed.contains("\"") || trimmed.contains("\n") {
                    return "\"" + trimmed.replacingOccurrences(of: "\"", with: "\"\"") + "\""
                }
                return trimmed
            }
            return cells.joined(separator: ",")
        }

        return csvRows.joined(separator: "\n")
    }

    /// Presents an NSSavePanel and exports the first markdown table as CSV.
    static func export(from markdown: String) {
        guard let csv = csvString(from: markdown) else { return }

        let panel = NSSavePanel()
        panel.title = "Export Table as CSV"
        panel.nameFieldStringValue = "table.csv"
        panel.allowedContentTypes = [UTType.commaSeparatedText]

        guard panel.runModal() == .OK, let url = panel.url else { return }
        try? csv.write(to: url, atomically: true, encoding: .utf8)
    }
}

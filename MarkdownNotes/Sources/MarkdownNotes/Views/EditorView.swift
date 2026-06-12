import SwiftUI

struct EditorView: View {
    @ObservedObject var manager: NotesManager
    @ObservedObject var webViewStore: PreviewWebViewStore

    private func contentBinding(for noteID: UUID) -> Binding<String> {
        Binding(
            get: { manager.notes.first(where: { $0.id == noteID })?.content ?? "" },
            set: { manager.updateNoteContent(noteID, content: $0) }
        )
    }

    private var currentContent: String {
        guard let noteID = manager.selectedNoteID else { return "" }
        return manager.notes.first(where: { $0.id == noteID })?.content ?? ""
    }

    private var hasMermaidBlock: Bool {
        currentContent.contains("```mermaid")
    }

    private var hasMarkdownTable: Bool {
        let lines = currentContent.components(separatedBy: "\n")
        return lines.contains { line in
            let trimmed = line.trimmingCharacters(in: .whitespaces)
            return trimmed.hasPrefix("|") && trimmed.hasSuffix("|") && trimmed.count >= 3
        }
    }

    var body: some View {
        if let noteID = manager.selectedNoteID,
           manager.notes.contains(where: { $0.id == noteID }) {
            VStack(spacing: 0) {
                HStack(spacing: 0) {
                    ToolbarView(content: contentBinding(for: noteID))

                    if hasMarkdownTable {
                        csvExportButton
                    }

                    if hasMermaidBlock {
                        exportMenu
                    }
                }

                HighlightedTextView(text: contentBinding(for: noteID))
                    .id(noteID) // reset view when switching notes

                StatusBarView(content: currentContent)
            }
            .overlay {
                // Hidden buttons to capture keyboard shortcuts
                keyboardShortcutButtons(for: noteID)
            }
        } else {
            VStack {
                Image(systemName: "doc.text")
                    .font(.system(size: 48))
                    .foregroundStyle(.tertiary)
                Text("Select or create a note")
                    .font(.title3)
                    .foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }

    @ViewBuilder
    private func keyboardShortcutButtons(for noteID: UUID) -> some View {
        let binding = contentBinding(for: noteID)
        VStack {
            Button("Bold") {
                binding.wrappedValue += "**text**"
            }
            .keyboardShortcut("b", modifiers: .command)

            Button("Italic") {
                binding.wrappedValue += "_text_"
            }
            .keyboardShortcut("i", modifiers: .command)

            Button("Strikethrough") {
                binding.wrappedValue += "~~text~~"
            }
            .keyboardShortcut("s", modifiers: [.command, .shift])
        }
        .frame(width: 0, height: 0)
        .opacity(0)
        .allowsHitTesting(false)
    }

    private var csvExportButton: some View {
        Button {
            TableCSVExporter.export(from: currentContent)
        } label: {
            Label("Export Table as CSV", systemImage: "tablecells")
                .font(.system(size: 13))
        }
        .buttonStyle(.borderless)
        .padding(.trailing, 8)
        .help("Export first table as CSV")
    }

    private var exportMenu: some View {
        Menu {
            Button("Export as PNG") { exportDiagram(format: .png) }
            Button("Export as SVG") { exportDiagram(format: .svg) }
        } label: {
            Label("Export Diagram", systemImage: "square.and.arrow.up")
                .font(.system(size: 13))
        }
        .menuStyle(.borderlessButton)
        .frame(width: 140)
        .padding(.trailing, 8)
        .help("Export rendered diagram")
    }

    private func exportDiagram(format: DiagramExporter.ExportFormat) {
        Task {
            let script = "document.querySelector('.mermaid svg')?.outerHTML ?? ''"
            guard let result = try? await webViewStore.evaluateJavaScript(script),
                  let svgString = result as? String,
                  !svgString.isEmpty else {
                return
            }
            await MainActor.run {
                DiagramExporter.export(svgString: svgString, format: format)
            }
        }
    }
}

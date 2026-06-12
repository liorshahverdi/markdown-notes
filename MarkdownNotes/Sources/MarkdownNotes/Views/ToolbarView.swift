import SwiftUI

struct ToolbarView: View {
    @Binding var content: String
    @State private var diagramColor: Color = .blue
    @State private var showColorPicker = false

    var body: some View {
        ViewThatFits(in: .horizontal) {
            // Full layout — all buttons expanded
            toolbarContent(collapsed: false)
            // Compact layout — format buttons collapse into menus
            toolbarContent(collapsed: true)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(.bar)
    }

    @ViewBuilder
    private func toolbarContent(collapsed: Bool) -> some View {
        HStack(spacing: 4) {
            if collapsed {
                headingsMenu
                divider
                formattingMenu
                divider
                listsMenu
            } else {
                headingsGroup
                divider
                formattingGroup
                divider
                listsGroup
            }

            divider
            tableMenu
            divider
            diagramMenu

            Spacer()
        }
    }

    private var divider: some View {
        Divider().frame(height: 20).padding(.horizontal, 4)
    }

    // MARK: - Expanded button groups

    private var headingsGroup: some View {
        Group {
            formatButton("H1", help: "Heading 1") { prependToLine("# ") }
            formatButton("H2", help: "Heading 2") { prependToLine("## ") }
            formatButton("H3", help: "Heading 3") { prependToLine("### ") }
        }
    }

    private var formattingGroup: some View {
        Group {
            formatButton("B", help: "Bold") { wrapSelection("**") }
                .fontWeight(.bold)
            formatButton("I", help: "Italic") { wrapSelection("_") }
                .italic()
            formatButton("S", help: "Strikethrough") { wrapSelection("~~") }
                .strikethrough()
        }
    }

    private var listsGroup: some View {
        Group {
            formatButton("☐", help: "Todo checkbox") { prependToLine("- [ ] ") }
            formatButton("•", help: "Unordered list") { prependToLine("- ") }
            formatButton("1.", help: "Ordered list") { prependToLine("1. ") }
        }
    }

    // MARK: - Collapsed menus (narrow width)

    private var headingsMenu: some View {
        Menu {
            Button("Heading 1") { prependToLine("# ") }
            Button("Heading 2") { prependToLine("## ") }
            Button("Heading 3") { prependToLine("### ") }
        } label: {
            Label("Heading", systemImage: "textformat.size")
                .font(.system(size: 13))
        }
        .menuStyle(.borderlessButton)
        .frame(width: 90)
        .help("Insert heading")
    }

    private var formattingMenu: some View {
        Menu {
            Button("Bold") { wrapSelection("**") }
            Button("Italic") { wrapSelection("_") }
            Button("Strikethrough") { wrapSelection("~~") }
        } label: {
            Label("Format", systemImage: "bold.italic.underline")
                .font(.system(size: 13))
        }
        .menuStyle(.borderlessButton)
        .frame(width: 85)
        .help("Text formatting")
    }

    private var listsMenu: some View {
        Menu {
            Button("Todo checkbox") { prependToLine("- [ ] ") }
            Button("Unordered list") { prependToLine("- ") }
            Button("Ordered list") { prependToLine("1. ") }
        } label: {
            Label("List", systemImage: "list.bullet")
                .font(.system(size: 13))
        }
        .menuStyle(.borderlessButton)
        .frame(width: 65)
        .help("Insert list")
    }

    // MARK: - Always-menu items

    private var tableMenu: some View {
        Menu {
            Button("Insert Table") { insertTable() }
            Button("Add Row") { addRow() }
            Button("Add Column") { addColumn() }
        } label: {
            Label("Table", systemImage: "tablecells")
                .font(.system(size: 13))
        }
        .menuStyle(.borderlessButton)
        .frame(width: 80)
        .help("Table helpers")
    }

    private var diagramMenu: some View {
        Menu {
            Button("Flowchart") { insertDiagram(DiagramTemplates.flowchart) }
            Button("Sequence Diagram") { insertDiagram(DiagramTemplates.sequence) }
            Button("Class Diagram") { insertDiagram(DiagramTemplates.classDiagram) }
            Button("Decision Tree") { insertDiagram(DiagramTemplates.decisionTree) }
            Button("Mind Map") { insertDiagram(DiagramTemplates.mindMap) }
            Button("Timeline") { insertDiagram(DiagramTemplates.timeline) }
            Divider()
            Button("Set Node Color...") { showColorPicker = true }
        } label: {
            Label("Diagram", systemImage: "diagram")
                .font(.system(size: 13))
        }
        .menuStyle(.borderlessButton)
        .frame(width: 100)
        .help("Insert diagram template")
        .popover(isPresented: $showColorPicker) {
            VStack(spacing: 12) {
                Text("Node Color")
                    .font(.headline)
                ColorPicker("Pick a color", selection: $diagramColor, supportsOpacity: false)
                    .labelsHidden()
                    .frame(width: 200)
                Button("Insert classDef") {
                    insertClassDef()
                    showColorPicker = false
                }
                .buttonStyle(.borderedProminent)
            }
            .padding()
            .frame(width: 240)
        }
    }

    private func formatButton(_ label: String, help: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(label)
                .font(.system(size: 13, design: .monospaced))
                .frame(minWidth: 28, minHeight: 24)
        }
        .buttonStyle(.bordered)
        .help(help)
    }

    private func wrapSelection(_ wrapper: String) {
        // Since TextEditor doesn't expose selection, wrap at cursor (end of content)
        // or wrap "text" placeholder
        content += "\(wrapper)text\(wrapper)"
    }

    private func prependToLine(_ prefix: String) {
        // Insert at the beginning of the last line, or append a new line
        if content.isEmpty || content.hasSuffix("\n") {
            content += "\(prefix)"
        } else {
            content += "\n\(prefix)"
        }
    }

    private func insertDiagram(_ template: String) {
        let prefix = content.isEmpty || content.hasSuffix("\n") ? "" : "\n"
        content += "\(prefix)```mermaid\n\(template)\n```\n"
    }

    // MARK: - Table helpers

    private func insertTable() {
        let table = """
        | Column 1 | Column 2 | Column 3 |
        |----------|----------|----------|
        | data     | data     | data     |
        | data     | data     | data     |
        """
        let prefix = content.isEmpty || content.hasSuffix("\n") ? "" : "\n"
        content += "\(prefix)\(table)\n"
    }

    private func addRow() {
        let lines = content.components(separatedBy: "\n")

        // Find the last table row
        guard let lastTableIndex = lines.lastIndex(where: { isTableRow($0) }) else {
            insertTable()
            return
        }

        let lastRow = lines[lastTableIndex]
        let cellCount = lastRow.components(separatedBy: "|").count - 2 // subtract leading/trailing empty splits
        guard cellCount > 0 else { return }

        let newRow = "|" + Array(repeating: "  ", count: cellCount).map { " \($0) |" }.joined()
        var mutableLines = lines
        mutableLines.insert(newRow, at: lastTableIndex + 1)
        content = mutableLines.joined(separator: "\n")
    }

    private func addColumn() {
        let lines = content.components(separatedBy: "\n")

        // Find all consecutive table lines (last table block)
        var tableEnd = -1
        var tableStart = -1
        for i in stride(from: lines.count - 1, through: 0, by: -1) {
            if isTableRow(lines[i]) {
                if tableEnd == -1 { tableEnd = i }
                tableStart = i
            } else if tableEnd != -1 {
                break
            }
        }

        guard tableStart >= 0 else {
            insertTable()
            return
        }

        var mutableLines = lines
        for i in tableStart...tableEnd {
            let trimmed = mutableLines[i].trimmingCharacters(in: .whitespaces)
            if isSeparatorRow(trimmed) {
                mutableLines[i] = trimmed + " --- |"
            } else {
                mutableLines[i] = trimmed + " New |"
            }
        }
        content = mutableLines.joined(separator: "\n")
    }

    private func isTableRow(_ line: String) -> Bool {
        let trimmed = line.trimmingCharacters(in: .whitespaces)
        return trimmed.hasPrefix("|") && trimmed.hasSuffix("|") && trimmed.count >= 3
    }

    private func isSeparatorRow(_ line: String) -> Bool {
        let inner = line.dropFirst().dropLast()
        let allowed = CharacterSet(charactersIn: "|- :")
        return inner.unicodeScalars.allSatisfy { allowed.contains($0) }
    }

    // MARK: - Color picker

    private func insertClassDef() {
        let nsColor = NSColor(diagramColor)
        let rgb = nsColor.usingColorSpace(.sRGB) ?? nsColor
        let r = Int(rgb.redComponent * 255)
        let g = Int(rgb.greenComponent * 255)
        let b = Int(rgb.blueComponent * 255)
        let hex = String(format: "#%02x%02x%02x", r, g, b)

        // Darken for stroke
        let sr = Int(Double(r) * 0.8)
        let sg = Int(Double(g) * 0.8)
        let sb = Int(Double(b) * 0.8)
        let strokeHex = String(format: "#%02x%02x%02x", sr, sg, sb)

        let classDef = "classDef myColor fill:\(hex),stroke:\(strokeHex),color:#fff"
        let prefix = content.isEmpty || content.hasSuffix("\n") ? "" : "\n"
        content += "\(prefix)\(classDef)\n"
    }
}

enum DiagramTemplates {
    static let flowchart = """
        graph TD
            A[Start]:::green --> B{Decision}:::orange
            B -->|Yes| C[Do thing]:::blue
            B -->|No| D[Other thing]:::red
            C --> E[End]:::green
            D --> E

            classDef green fill:#2ecc71,stroke:#27ae60,color:#fff
            classDef blue fill:#3498db,stroke:#2980b9,color:#fff
            classDef orange fill:#f39c12,stroke:#e67e22,color:#fff
            classDef red fill:#e74c3c,stroke:#c0392b,color:#fff
        """

    static let sequence = """
        sequenceDiagram
            actor User
            participant App
            participant Server

            rect rgb(232, 245, 233)
                User->>App: Click button
                App->>Server: API request
            end
            rect rgb(227, 242, 253)
                Server-->>App: Response
                App-->>User: Show result
            end
        """

    static let classDiagram = """
        classDiagram
            class Animal {
                +String name
                +int age
                +makeSound()
            }
            class Dog {
                +fetch()
            }
            class Cat {
                +purr()
            }
            Animal <|-- Dog
            Animal <|-- Cat

            style Animal fill:#f9e79f,stroke:#f1c40f,color:#333
            style Dog fill:#aed6f1,stroke:#3498db,color:#333
            style Cat fill:#d5f5e3,stroke:#2ecc71,color:#333
        """

    static let decisionTree = """
        graph TD
            A{Is it raining?}:::orange
            A -->|Yes| B{Have umbrella?}:::orange
            A -->|No| C[Go outside]:::green
            B -->|Yes| D[Take umbrella]:::blue
            B -->|No| E[Stay inside]:::red
            D --> C

            classDef green fill:#2ecc71,stroke:#27ae60,color:#fff
            classDef blue fill:#3498db,stroke:#2980b9,color:#fff
            classDef orange fill:#f39c12,stroke:#e67e22,color:#fff
            classDef red fill:#e74c3c,stroke:#c0392b,color:#fff
        """

    static let mindMap = """
        mindmap
            root((Project))
                ::icon(fa fa-pencil)
                Design
                    UI Mockups
                    User Research
                Development
                    Frontend
                    Backend
                Testing
                    Unit Tests
                    Integration
        """

    static let timeline = """
        timeline
            title Project Timeline
            section Phase 1
                Research : Gather requirements
                Design : Create mockups
            section Phase 2
                Develop : Build features
                Test : QA testing
            section Phase 3
                Launch : Go live
                Monitor : Track metrics
        """
}

import SwiftUI
import AppKit

@main
struct MarkdownNotesApp: App {
    init() {
        // When launched via `swift run`, the process is a background app by default.
        // This activates it as a regular foreground app so it receives keyboard input.
        NSApplication.shared.setActivationPolicy(.regular)
        NSApplication.shared.activate(ignoringOtherApps: true)
        NSApplication.shared.applicationIconImage = AppIcon.create()
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
        .windowStyle(.titleBar)
        .defaultSize(width: 1200, height: 700)
    }
}

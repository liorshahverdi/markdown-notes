import SwiftUI

struct ContentView: View {
    @StateObject private var manager = NotesManager()
    @StateObject private var webViewStore = PreviewWebViewStore()

    var body: some View {
        NavigationSplitView {
            SidebarView(manager: manager)
                .frame(minWidth: 200, idealWidth: 250)
        } detail: {
            HSplitView {
                EditorView(manager: manager, webViewStore: webViewStore)
                    .frame(minWidth: 300)

                PreviewView(markdown: manager.selectedNote?.content ?? "", webViewStore: webViewStore)
                    .frame(minWidth: 300)
            }
        }
        .frame(minWidth: 900, minHeight: 500)
    }
}

import SwiftUI
import WebKit

/// A WKWebView subclass that never steals first responder from the editor.
class NonFocusableWebView: WKWebView {
    override var acceptsFirstResponder: Bool { false }
}

/// Holds a reference to the preview WebView so other views can evaluate JS on it.
class PreviewWebViewStore: ObservableObject {
    var webView: WKWebView?

    func evaluateJavaScript(_ script: String) async throws -> Any? {
        guard let webView else { return nil }
        return try await webView.evaluateJavaScript(script)
    }
}

struct PreviewView: NSViewRepresentable {
    let markdown: String
    var webViewStore: PreviewWebViewStore?

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeNSView(context: Context) -> NonFocusableWebView {
        let config = WKWebViewConfiguration()
        let webView = NonFocusableWebView(frame: .zero, configuration: config)
        webView.setValue(false, forKey: "drawsBackground")
        DispatchQueue.main.async {
            webViewStore?.webView = webView
        }
        return webView
    }

    func updateNSView(_ webView: NonFocusableWebView, context: Context) {
        // Debounce: schedule an update, cancelling any pending one
        context.coordinator.scheduleUpdate(markdown: markdown, webView: webView)
    }

    class Coordinator {
        private var workItem: DispatchWorkItem?
        private var lastRendered: String?

        func scheduleUpdate(markdown: String, webView: WKWebView) {
            workItem?.cancel()
            let item = DispatchWorkItem { [weak self] in
                guard markdown != self?.lastRendered else { return }
                self?.lastRendered = markdown
                let html = MarkdownRenderer.renderHTML(from: markdown)
                webView.loadHTMLString(html, baseURL: nil)
            }
            workItem = item
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.3, execute: item)
        }
    }
}

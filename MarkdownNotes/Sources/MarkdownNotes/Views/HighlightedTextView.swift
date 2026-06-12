import SwiftUI
import AppKit

struct HighlightedTextView: NSViewRepresentable {
    @Binding var text: String

    func makeCoordinator() -> Coordinator {
        Coordinator(parent: self)
    }

    func makeNSView(context: Context) -> NSScrollView {
        let scrollView = NSTextView.scrollableTextView()
        let textView = scrollView.documentView as! NSTextView

        textView.delegate = context.coordinator
        textView.font = MarkdownHighlighter.baseFont
        textView.textColor = .textColor
        textView.isRichText = false
        textView.allowsUndo = true
        textView.isAutomaticTextReplacementEnabled = false
        textView.isAutomaticQuoteSubstitutionEnabled = false
        textView.isAutomaticDashSubstitutionEnabled = false
        textView.isAutomaticSpellingCorrectionEnabled = false
        textView.usesFindBar = true
        textView.isEditable = true
        textView.isSelectable = true

        // Allow the text view to resize horizontally with its container
        textView.isHorizontallyResizable = false
        textView.isVerticallyResizable = true
        textView.autoresizingMask = [.width]
        textView.textContainer?.widthTracksTextView = true

        // Set initial text and highlight
        textView.string = text
        context.coordinator.applyHighlighting(to: textView)

        return scrollView
    }

    func updateNSView(_ scrollView: NSScrollView, context: Context) {
        guard let textView = scrollView.documentView as? NSTextView else { return }

        // Only update if the text has actually changed externally
        // (not from our own typing)
        if textView.string != text {
            let selectedRanges = textView.selectedRanges
            context.coordinator.isUpdating = true
            textView.string = text
            context.coordinator.isUpdating = false

            // Restore selection, clamping to valid range
            let maxLength = (text as NSString).length
            let restoredRanges = selectedRanges.compactMap { rangeValue -> NSValue? in
                let range = rangeValue.rangeValue
                let clampedLocation = min(range.location, maxLength)
                let clampedLength = min(range.length, maxLength - clampedLocation)
                return NSValue(range: NSRange(location: clampedLocation, length: clampedLength))
            }
            if !restoredRanges.isEmpty {
                textView.selectedRanges = restoredRanges
            }

            context.coordinator.applyHighlighting(to: textView)
        }
    }

    class Coordinator: NSObject, NSTextViewDelegate {
        var parent: HighlightedTextView
        var isUpdating = false
        private var highlightWorkItem: DispatchWorkItem?

        init(parent: HighlightedTextView) {
            self.parent = parent
        }

        func textDidChange(_ notification: Notification) {
            guard let textView = notification.object as? NSTextView else { return }
            guard !isUpdating else { return }

            parent.text = textView.string
            scheduleHighlighting(for: textView)
        }

        private func scheduleHighlighting(for textView: NSTextView) {
            highlightWorkItem?.cancel()
            let workItem = DispatchWorkItem { [weak self] in
                self?.applyHighlighting(to: textView)
            }
            highlightWorkItem = workItem
            // Debounce: 50ms delay
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.05, execute: workItem)
        }

        func applyHighlighting(to textView: NSTextView) {
            guard let textStorage = textView.textStorage else { return }
            let text = textView.string
            let attributed = MarkdownHighlighter.highlight(text)

            let selectedRanges = textView.selectedRanges

            isUpdating = true
            textStorage.beginEditing()
            textStorage.setAttributedString(attributed)
            textStorage.endEditing()
            isUpdating = false

            // Restore selection
            let maxLength = (text as NSString).length
            let restoredRanges = selectedRanges.compactMap { rangeValue -> NSValue? in
                let range = rangeValue.rangeValue
                let clampedLocation = min(range.location, maxLength)
                let clampedLength = min(range.length, maxLength - clampedLocation)
                return NSValue(range: NSRange(location: clampedLocation, length: clampedLength))
            }
            if !restoredRanges.isEmpty {
                textView.selectedRanges = restoredRanges
            }
        }
    }
}

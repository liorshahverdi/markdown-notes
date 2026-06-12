import AppKit

struct DiagramExporter {
    enum ExportFormat: String {
        case png, svg
    }

    /// Presents an NSSavePanel and saves the diagram SVG as the chosen format.
    static func export(svgString: String, format: ExportFormat = .png) {
        let panel = NSSavePanel()
        panel.title = "Export Diagram"
        panel.nameFieldStringValue = "diagram.\(format.rawValue)"
        panel.allowedContentTypes = format == .png
            ? [.png]
            : [.svg]

        guard panel.runModal() == .OK, let url = panel.url else { return }

        switch format {
        case .svg:
            try? svgString.write(to: url, atomically: true, encoding: .utf8)
        case .png:
            guard let svgData = svgString.data(using: .utf8),
                  let nsImage = NSImage(data: svgData),
                  let tiffData = nsImage.tiffRepresentation,
                  let bitmap = NSBitmapImageRep(data: tiffData),
                  let pngData = bitmap.representation(using: .png, properties: [:]) else {
                // Fallback: save SVG data directly if conversion fails
                try? svgString.write(to: url, atomically: true, encoding: .utf8)
                return
            }
            try? pngData.write(to: url)
        }
    }
}

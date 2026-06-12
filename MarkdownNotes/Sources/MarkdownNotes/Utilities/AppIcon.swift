import AppKit

enum AppIcon {
    static func create() -> NSImage {
        let size = NSSize(width: 512, height: 512)
        let image = NSImage(size: size, flipped: false) { rect in
            // --- Background: rounded square ---
            let bgPath = NSBezierPath(roundedRect: rect.insetBy(dx: 16, dy: 16), xRadius: 100, yRadius: 100)

            // Gradient from deep indigo to purple
            let gradient = NSGradient(colors: [
                NSColor(red: 0.22, green: 0.20, blue: 0.52, alpha: 1),
                NSColor(red: 0.38, green: 0.25, blue: 0.62, alpha: 1),
            ])!
            gradient.draw(in: bgPath, angle: -45)

            // --- Subtle inner shadow / border ---
            NSColor.white.withAlphaComponent(0.12).setStroke()
            bgPath.lineWidth = 3
            bgPath.stroke()

            // --- Page shape (white, slightly tilted) ---
            let page = NSBezierPath()
            let px: CGFloat = 140, py: CGFloat = 70
            let pw: CGFloat = 240, ph: CGFloat = 320
            let fold: CGFloat = 50

            page.move(to: NSPoint(x: px, y: py))
            page.line(to: NSPoint(x: px + pw - fold, y: py))
            page.line(to: NSPoint(x: px + pw, y: py + fold))
            page.line(to: NSPoint(x: px + pw, y: py + ph))
            page.line(to: NSPoint(x: px, y: py + ph))
            page.close()

            // Page shadow
            let shadow = NSShadow()
            shadow.shadowColor = NSColor.black.withAlphaComponent(0.35)
            shadow.shadowOffset = NSSize(width: 4, height: -6)
            shadow.shadowBlurRadius = 18

            NSGraphicsContext.saveGraphicsState()
            shadow.set()
            NSColor.white.withAlphaComponent(0.95).setFill()
            page.fill()
            NSGraphicsContext.restoreGraphicsState()

            // Page fold triangle
            let foldPath = NSBezierPath()
            foldPath.move(to: NSPoint(x: px + pw - fold, y: py))
            foldPath.line(to: NSPoint(x: px + pw - fold, y: py + fold))
            foldPath.line(to: NSPoint(x: px + pw, y: py + fold))
            foldPath.close()
            NSColor(white: 0.88, alpha: 1).setFill()
            foldPath.fill()

            // --- Markdown lines on the page ---
            let lineColor = NSColor(red: 0.25, green: 0.22, blue: 0.50, alpha: 1)

            // "# " heading — thick bar
            drawTextLine(x: px + 28, y: py + ph - 70, width: 160, height: 14, radius: 4, color: lineColor)

            // Body lines
            let bodyColor = NSColor(white: 0.55, alpha: 1)
            drawTextLine(x: px + 28, y: py + ph - 110, width: 190, height: 8, radius: 3, color: bodyColor)
            drawTextLine(x: px + 28, y: py + ph - 132, width: 170, height: 8, radius: 3, color: bodyColor)
            drawTextLine(x: px + 28, y: py + ph - 154, width: 140, height: 8, radius: 3, color: bodyColor)

            // --- Mermaid diagram nodes overlapping the page ---
            let nodeA = NSRect(x: 280, y: 260, width: 120, height: 50)
            let nodeB = NSRect(x: 200, y: 160, width: 100, height: 44)
            let nodeC = NSRect(x: 340, y: 160, width: 100, height: 44)

            // Connector lines (draw before nodes)
            NSColor.white.withAlphaComponent(0.8).setStroke()
            let connectorWidth: CGFloat = 3

            let lineAB = NSBezierPath()
            lineAB.move(to: NSPoint(x: nodeA.midX - 30, y: nodeA.minY))
            lineAB.line(to: NSPoint(x: nodeB.midX, y: nodeB.maxY))
            lineAB.lineWidth = connectorWidth
            lineAB.stroke()

            let lineAC = NSBezierPath()
            lineAC.move(to: NSPoint(x: nodeA.midX + 30, y: nodeA.minY))
            lineAC.line(to: NSPoint(x: nodeC.midX, y: nodeC.maxY))
            lineAC.lineWidth = connectorWidth
            lineAC.stroke()

            // Node A — teal
            drawNode(rect: nodeA,
                     fill: NSColor(red: 0.16, green: 0.78, blue: 0.65, alpha: 1),
                     radius: 12)

            // Node B — coral
            drawNode(rect: nodeB,
                     fill: NSColor(red: 0.91, green: 0.40, blue: 0.36, alpha: 1),
                     radius: 10)

            // Node C — amber
            drawNode(rect: nodeC,
                     fill: NSColor(red: 0.95, green: 0.73, blue: 0.20, alpha: 1),
                     radius: 10)

            // Small white bars inside nodes to suggest labels
            drawTextLine(x: nodeA.minX + 25, y: nodeA.minY + 20, width: 70, height: 10, radius: 3,
                         color: .white.withAlphaComponent(0.85))
            drawTextLine(x: nodeB.minX + 20, y: nodeB.minY + 17, width: 60, height: 8, radius: 3,
                         color: .white.withAlphaComponent(0.85))
            drawTextLine(x: nodeC.minX + 20, y: nodeC.minY + 17, width: 60, height: 8, radius: 3,
                         color: .white.withAlphaComponent(0.85))

            return true
        }

        return image
    }

    private static func drawTextLine(x: CGFloat, y: CGFloat, width: CGFloat, height: CGFloat,
                                     radius: CGFloat, color: NSColor) {
        let rect = NSRect(x: x, y: y, width: width, height: height)
        let path = NSBezierPath(roundedRect: rect, xRadius: radius, yRadius: radius)
        color.setFill()
        path.fill()
    }

    private static func drawNode(rect: NSRect, fill: NSColor, radius: CGFloat) {
        let shadow = NSShadow()
        shadow.shadowColor = NSColor.black.withAlphaComponent(0.3)
        shadow.shadowOffset = NSSize(width: 2, height: -3)
        shadow.shadowBlurRadius = 8

        NSGraphicsContext.saveGraphicsState()
        shadow.set()
        let path = NSBezierPath(roundedRect: rect, xRadius: radius, yRadius: radius)
        fill.setFill()
        path.fill()
        NSGraphicsContext.restoreGraphicsState()
    }
}

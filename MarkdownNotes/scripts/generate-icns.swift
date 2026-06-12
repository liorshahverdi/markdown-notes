#!/usr/bin/env swift
// generate-icns.swift — Renders AppIcon at multiple sizes and creates .icns via iconutil
// Usage: swift generate-icns.swift <output-dir>
//   Produces <output-dir>/AppIcon.icns

import AppKit
import Foundation

// MARK: - Icon drawing (duplicated from AppIcon.swift to keep this standalone)

func drawTextLine(x: CGFloat, y: CGFloat, width: CGFloat, height: CGFloat,
                  radius: CGFloat, color: NSColor) {
    let rect = NSRect(x: x, y: y, width: width, height: height)
    let path = NSBezierPath(roundedRect: rect, xRadius: radius, yRadius: radius)
    color.setFill()
    path.fill()
}

func drawNode(rect: NSRect, fill: NSColor, radius: CGFloat) {
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

func createIcon() -> NSImage {
    let size = NSSize(width: 512, height: 512)
    let image = NSImage(size: size, flipped: false) { rect in
        let bgPath = NSBezierPath(roundedRect: rect.insetBy(dx: 16, dy: 16), xRadius: 100, yRadius: 100)
        let gradient = NSGradient(colors: [
            NSColor(red: 0.22, green: 0.20, blue: 0.52, alpha: 1),
            NSColor(red: 0.38, green: 0.25, blue: 0.62, alpha: 1),
        ])!
        gradient.draw(in: bgPath, angle: -45)

        NSColor.white.withAlphaComponent(0.12).setStroke()
        bgPath.lineWidth = 3
        bgPath.stroke()

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

        let shadow = NSShadow()
        shadow.shadowColor = NSColor.black.withAlphaComponent(0.35)
        shadow.shadowOffset = NSSize(width: 4, height: -6)
        shadow.shadowBlurRadius = 18

        NSGraphicsContext.saveGraphicsState()
        shadow.set()
        NSColor.white.withAlphaComponent(0.95).setFill()
        page.fill()
        NSGraphicsContext.restoreGraphicsState()

        let foldPath = NSBezierPath()
        foldPath.move(to: NSPoint(x: px + pw - fold, y: py))
        foldPath.line(to: NSPoint(x: px + pw - fold, y: py + fold))
        foldPath.line(to: NSPoint(x: px + pw, y: py + fold))
        foldPath.close()
        NSColor(white: 0.88, alpha: 1).setFill()
        foldPath.fill()

        let lineColor = NSColor(red: 0.25, green: 0.22, blue: 0.50, alpha: 1)
        drawTextLine(x: px + 28, y: py + ph - 70, width: 160, height: 14, radius: 4, color: lineColor)

        let bodyColor = NSColor(white: 0.55, alpha: 1)
        drawTextLine(x: px + 28, y: py + ph - 110, width: 190, height: 8, radius: 3, color: bodyColor)
        drawTextLine(x: px + 28, y: py + ph - 132, width: 170, height: 8, radius: 3, color: bodyColor)
        drawTextLine(x: px + 28, y: py + ph - 154, width: 140, height: 8, radius: 3, color: bodyColor)

        let nodeA = NSRect(x: 280, y: 260, width: 120, height: 50)
        let nodeB = NSRect(x: 200, y: 160, width: 100, height: 44)
        let nodeC = NSRect(x: 340, y: 160, width: 100, height: 44)

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

        drawNode(rect: nodeA,
                 fill: NSColor(red: 0.16, green: 0.78, blue: 0.65, alpha: 1),
                 radius: 12)
        drawNode(rect: nodeB,
                 fill: NSColor(red: 0.91, green: 0.40, blue: 0.36, alpha: 1),
                 radius: 10)
        drawNode(rect: nodeC,
                 fill: NSColor(red: 0.95, green: 0.73, blue: 0.20, alpha: 1),
                 radius: 10)

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

// MARK: - Render to .icns

guard CommandLine.arguments.count >= 2 else {
    fputs("Usage: swift generate-icns.swift <output-dir>\n", stderr)
    exit(1)
}

let outputDir = CommandLine.arguments[1]
let iconsetPath = (outputDir as NSString).appendingPathComponent("AppIcon.iconset")
let icnsPath = (outputDir as NSString).appendingPathComponent("AppIcon.icns")

let fm = FileManager.default
try? fm.removeItem(atPath: iconsetPath)
try fm.createDirectory(atPath: iconsetPath, withIntermediateDirectories: true)

let icon = createIcon()

// Standard macOS icon sizes: 16, 32, 128, 256, 512 at 1x and 2x
let sizes: [(Int, String)] = [
    (16,   "icon_16x16.png"),
    (32,   "icon_16x16@2x.png"),
    (32,   "icon_32x32.png"),
    (64,   "icon_32x32@2x.png"),
    (128,  "icon_128x128.png"),
    (256,  "icon_128x128@2x.png"),
    (256,  "icon_256x256.png"),
    (512,  "icon_256x256@2x.png"),
    (512,  "icon_512x512.png"),
    (1024, "icon_512x512@2x.png"),
]

for (px, filename) in sizes {
    let sz = NSSize(width: px, height: px)
    let bitmapRep = NSBitmapImageRep(
        bitmapDataPlanes: nil,
        pixelsWide: px,
        pixelsHigh: px,
        bitsPerSample: 8,
        samplesPerPixel: 4,
        hasAlpha: true,
        isPlanar: false,
        colorSpaceName: .deviceRGB,
        bytesPerRow: 0,
        bitsPerPixel: 0
    )!
    bitmapRep.size = sz

    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: bitmapRep)
    icon.draw(in: NSRect(origin: .zero, size: sz),
              from: NSRect(origin: .zero, size: icon.size),
              operation: .copy,
              fraction: 1.0)
    NSGraphicsContext.restoreGraphicsState()

    guard let pngData = bitmapRep.representation(using: .png, properties: [:]) else {
        fputs("Failed to create PNG for \(filename)\n", stderr)
        exit(1)
    }

    let filePath = (iconsetPath as NSString).appendingPathComponent(filename)
    try pngData.write(to: URL(fileURLWithPath: filePath))
}

// Convert iconset to icns
let process = Process()
process.executableURL = URL(fileURLWithPath: "/usr/bin/iconutil")
process.arguments = ["-c", "icns", iconsetPath, "-o", icnsPath]
try process.run()
process.waitUntilExit()

guard process.terminationStatus == 0 else {
    fputs("iconutil failed with status \(process.terminationStatus)\n", stderr)
    exit(1)
}

// Clean up iconset directory
try? fm.removeItem(atPath: iconsetPath)

print("Created \(icnsPath)")

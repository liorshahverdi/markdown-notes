#!/bin/bash
# bundle.sh — Build MarkdownNotes and create a proper .app bundle
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BUILD_DIR="$PROJECT_DIR/build"
APP_DIR="$BUILD_DIR/MarkdownNotes.app"
CONTENTS_DIR="$APP_DIR/Contents"
MACOS_DIR="$CONTENTS_DIR/MacOS"
RESOURCES_DIR="$CONTENTS_DIR/Resources"

echo "==> Building MarkdownNotes (release)..."
cd "$PROJECT_DIR"
swift build -c release

echo "==> Creating app bundle..."
rm -rf "$APP_DIR"
mkdir -p "$MACOS_DIR" "$RESOURCES_DIR"

# Copy the compiled binary
BINARY="$(swift build -c release --show-bin-path)/MarkdownNotes"
cp "$BINARY" "$MACOS_DIR/MarkdownNotes"

# Generate the app icon
echo "==> Generating AppIcon.icns..."
swift "$SCRIPT_DIR/generate-icns.swift" "$RESOURCES_DIR"

# Write Info.plist
cat > "$CONTENTS_DIR/Info.plist" << 'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleName</key>
    <string>MarkdownNotes</string>
    <key>CFBundleDisplayName</key>
    <string>Markdown Notes</string>
    <key>CFBundleIdentifier</key>
    <string>com.markdownnotes.app</string>
    <key>CFBundleVersion</key>
    <string>1.0</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0</string>
    <key>CFBundleExecutable</key>
    <string>MarkdownNotes</string>
    <key>CFBundleIconFile</key>
    <string>AppIcon</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleInfoDictionaryVersion</key>
    <string>6.0</string>
    <key>LSMinimumSystemVersion</key>
    <string>14.0</string>
    <key>NSHighResolutionCapable</key>
    <true/>
    <key>NSSupportsAutomaticTermination</key>
    <true/>
    <key>NSSupportsSuddenTermination</key>
    <false/>
</dict>
</plist>
PLIST

echo ""
echo "==> Done! App bundle created at:"
echo "    $APP_DIR"
echo ""
echo "    To launch:  open $APP_DIR"

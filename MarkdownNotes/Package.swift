// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "MarkdownNotes",
    platforms: [
        .macOS(.v14)
    ],
    dependencies: [],
    targets: [
        .executableTarget(
            name: "MarkdownNotes",
            path: "Sources/MarkdownNotes"
        ),
        .testTarget(
            name: "MarkdownNotesTests",
            dependencies: ["MarkdownNotes"],
            path: "Tests/MarkdownNotesTests"
        )
    ]
)

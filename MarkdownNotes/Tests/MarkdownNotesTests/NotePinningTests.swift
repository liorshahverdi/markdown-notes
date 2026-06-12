import XCTest
@testable import MarkdownNotes

final class NotePinningTests: XCTestCase {

    // MARK: - Note Model Tests

    func testNoteDefaultIsPinnedIsFalse() {
        let url = URL(fileURLWithPath: "/tmp/test.md")
        let note = Note(title: "Test", content: "", fileURL: url)
        XCTAssertFalse(note.isPinned)
    }

    func testNoteIsPinnedCanBeSetTrue() {
        let url = URL(fileURLWithPath: "/tmp/test.md")
        var note = Note(title: "Test", content: "", fileURL: url)
        note.isPinned = true
        XCTAssertTrue(note.isPinned)
    }

    func testSanitizedFileNameStillWorks() {
        let url = URL(fileURLWithPath: "/tmp/test.md")
        let note = Note(title: "Hello World!", content: "", fileURL: url)
        XCTAssertEqual(note.sanitizedFileName, "Hello World")
    }

    func testSanitizedFileNameWithPinnedNote() {
        let url = URL(fileURLWithPath: "/tmp/test.md")
        var note = Note(title: "My Note @#$", content: "", fileURL: url)
        note.isPinned = true
        XCTAssertEqual(note.sanitizedFileName, "My Note")
    }

    // MARK: - Sorting Tests

    func testFilteredNotesPinnedFirst() async {
        let manager = await makeTestManager()

        let now = Date()
        let url1 = URL(fileURLWithPath: "/tmp/a.md")
        let url2 = URL(fileURLWithPath: "/tmp/b.md")
        let url3 = URL(fileURLWithPath: "/tmp/c.md")

        await MainActor.run {
            var unpinned1 = Note(title: "Unpinned1", content: "", dateModified: now, fileURL: url1)
            unpinned1.isPinned = false

            var pinned = Note(title: "Pinned", content: "", dateModified: now.addingTimeInterval(-100), fileURL: url2)
            pinned.isPinned = true

            var unpinned2 = Note(title: "Unpinned2", content: "", dateModified: now.addingTimeInterval(-50), fileURL: url3)
            unpinned2.isPinned = false

            manager.notes = [unpinned1, pinned, unpinned2]

            let filtered = manager.filteredNotes
            XCTAssertEqual(filtered.count, 3)
            // Pinned note should be first even though it has the oldest date
            XCTAssertEqual(filtered[0].title, "Pinned")
            // Unpinned notes sorted by dateModified descending
            XCTAssertEqual(filtered[1].title, "Unpinned1")
            XCTAssertEqual(filtered[2].title, "Unpinned2")
        }
    }

    func testFilteredNotesPinnedGroupSortedByDate() async {
        let manager = await makeTestManager()

        let now = Date()
        let url1 = URL(fileURLWithPath: "/tmp/a.md")
        let url2 = URL(fileURLWithPath: "/tmp/b.md")

        await MainActor.run {
            var pinned1 = Note(title: "PinnedOlder", content: "", dateModified: now.addingTimeInterval(-200), fileURL: url1)
            pinned1.isPinned = true

            var pinned2 = Note(title: "PinnedNewer", content: "", dateModified: now, fileURL: url2)
            pinned2.isPinned = true

            manager.notes = [pinned1, pinned2]

            let filtered = manager.filteredNotes
            XCTAssertEqual(filtered[0].title, "PinnedNewer")
            XCTAssertEqual(filtered[1].title, "PinnedOlder")
        }
    }

    // MARK: - Toggle Pin Tests

    func testTogglePin() async {
        let manager = await makeTestManager()
        let url = URL(fileURLWithPath: "/tmp/test.md")

        await MainActor.run {
            let note = Note(title: "Test", content: "", fileURL: url)
            manager.notes = [note]
            let noteID = note.id

            XCTAssertFalse(manager.notes[0].isPinned)

            manager.togglePin(noteID)
            XCTAssertTrue(manager.notes[0].isPinned)

            manager.togglePin(noteID)
            XCTAssertFalse(manager.notes[0].isPinned)
        }
    }

    // MARK: - Pin Persistence Tests

    func testPinStateJSONEncodingDecoding() throws {
        // Test that we can encode and decode pin state as [String: Bool]
        let pins: [String: Bool] = ["note1.md": true, "note2.md": true]
        let data = try JSONEncoder().encode(pins)
        let decoded = try JSONDecoder().decode([String: Bool].self, from: data)
        XCTAssertEqual(decoded, pins)
    }

    func testSaveAndLoadPins() async throws {
        let tempDir = FileManager.default.temporaryDirectory
            .appendingPathComponent("MarkdownNotesTest-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: tempDir, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: tempDir) }

        let manager = await makeTestManager(directory: tempDir)

        // Create a .md file and load it
        let fileURL = tempDir.appendingPathComponent("TestNote.md")
        try "# Test".write(to: fileURL, atomically: true, encoding: .utf8)

        await MainActor.run {
            manager.loadNotes()
            guard let noteID = manager.notes.first?.id else {
                XCTFail("No notes loaded")
                return
            }

            // Pin the note
            manager.togglePin(noteID)
            XCTAssertTrue(manager.notes.first?.isPinned == true)
        }

        // Verify .pins.json file exists
        let pinsURL = tempDir.appendingPathComponent(".pins.json")
        XCTAssertTrue(FileManager.default.fileExists(atPath: pinsURL.path))

        // Create a new manager to simulate app restart
        let manager2 = await makeTestManager(directory: tempDir)
        await MainActor.run {
            manager2.loadNotes()
            XCTAssertTrue(manager2.notes.first?.isPinned == true, "Pin state should persist across loads")
        }
    }

    func testDeleteNoteRemovesPinEntry() async throws {
        let tempDir = FileManager.default.temporaryDirectory
            .appendingPathComponent("MarkdownNotesTest-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: tempDir, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: tempDir) }

        let manager = await makeTestManager(directory: tempDir)

        let fileURL = tempDir.appendingPathComponent("ToDelete.md")
        try "# Delete me".write(to: fileURL, atomically: true, encoding: .utf8)

        await MainActor.run {
            manager.loadNotes()
            guard let note = manager.notes.first else {
                XCTFail("No notes loaded")
                return
            }

            manager.togglePin(note.id)
            XCTAssertTrue(manager.notes.first?.isPinned == true)

            manager.deleteNote(note)
        }

        // Verify pin entry is removed from .pins.json
        let pinsURL = tempDir.appendingPathComponent(".pins.json")
        if FileManager.default.fileExists(atPath: pinsURL.path),
           let data = try? Data(contentsOf: pinsURL),
           let pins = try? JSONDecoder().decode([String: Bool].self, from: data) {
            XCTAssertNil(pins["ToDelete.md"], "Pin entry should be removed when note is deleted")
        }
        // If file doesn't exist, that's also acceptable (empty pins)
    }

    // MARK: - Helpers

    @MainActor
    private func makeTestManager(directory: URL? = nil) -> NotesManager {
        if let directory = directory {
            return NotesManager(notesDirectory: directory)
        }
        let tempDir = FileManager.default.temporaryDirectory
            .appendingPathComponent("MarkdownNotesTest-\(UUID().uuidString)")
        try? FileManager.default.createDirectory(at: tempDir, withIntermediateDirectories: true)
        return NotesManager(notesDirectory: tempDir)
    }
}

import Foundation
import Combine

@MainActor
class NotesManager: ObservableObject {
    @Published var notes: [Note] = []
    @Published var selectedNoteID: UUID?
    @Published var searchText: String = ""

    private let notesDirectory: URL
    private var saveTask: Task<Void, Never>?
    private var fileMonitor: DispatchSourceFileSystemObject?
    private var directoryDescriptor: Int32 = -1
    private var isSaving = false
    private var pendingSaveNoteIDs: Set<UUID> = []

    private var pinsFileURL: URL {
        notesDirectory.appendingPathComponent(".pins.json")
    }

    var filteredNotes: [Note] {
        let pinned = notes.filter { $0.isPinned }.sorted { $0.dateModified > $1.dateModified }
        let unpinned = notes.filter { !$0.isPinned }.sorted { $0.dateModified > $1.dateModified }
        let sorted = pinned + unpinned
        if searchText.isEmpty { return sorted }
        let query = searchText.lowercased()
        return sorted.filter {
            $0.title.lowercased().contains(query) ||
            $0.content.lowercased().contains(query)
        }
    }

    var selectedNote: Note? {
        get { notes.first { $0.id == selectedNoteID } }
        set {
            if let newValue, let index = notes.firstIndex(where: { $0.id == newValue.id }) {
                notes[index] = newValue
            }
        }
    }

    init() {
        let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
        notesDirectory = docs.appendingPathComponent("MarkdownNotes")
        ensureDirectory()
        loadNotes()
        startMonitoring()
    }

    init(notesDirectory: URL) {
        self.notesDirectory = notesDirectory
        ensureDirectory()
    }

    deinit {
        fileMonitor?.cancel()
        if directoryDescriptor != -1 {
            close(directoryDescriptor)
        }
    }

    private func ensureDirectory() {
        try? FileManager.default.createDirectory(at: notesDirectory, withIntermediateDirectories: true)
    }

    // MARK: - Pin Persistence

    private func loadPins() -> [String: Bool] {
        guard let data = try? Data(contentsOf: pinsFileURL),
              let pins = try? JSONDecoder().decode([String: Bool].self, from: data) else {
            return [:]
        }
        return pins
    }

    private func savePins() {
        let pins = notes
            .filter { $0.isPinned }
            .reduce(into: [String: Bool]()) { result, note in
                let filename = note.fileURL.lastPathComponent
                result[filename] = true
            }
        do {
            let data = try JSONEncoder().encode(pins)
            try data.write(to: pinsFileURL, options: .atomic)
        } catch {
            print("Failed to save pins: \(error)")
        }
    }

    // MARK: - Notes Loading

    func loadNotes() {
        let fm = FileManager.default
        guard let files = try? fm.contentsOfDirectory(at: notesDirectory, includingPropertiesForKeys: [.contentModificationDateKey]) else { return }

        let mdFiles = files.filter { $0.pathExtension == "md" }
        let pins = loadPins()
        var loaded: [Note] = []

        for fileURL in mdFiles {
            if let content = try? String(contentsOf: fileURL, encoding: .utf8) {
                let title = fileURL.deletingPathExtension().lastPathComponent
                let attrs = try? fm.attributesOfItem(atPath: fileURL.path)
                let modified = (attrs?[.modificationDate] as? Date) ?? Date()
                let filename = fileURL.lastPathComponent
                let isPinned = pins[filename] == true

                // Preserve existing ID if note already loaded
                let existingID = notes.first { $0.fileURL == fileURL }?.id
                let note = Note(
                    id: existingID ?? UUID(),
                    title: title,
                    content: content,
                    dateModified: modified,
                    fileURL: fileURL,
                    isPinned: isPinned
                )
                loaded.append(note)
            }
        }

        // Preserve in-memory content for notes with unsaved edits
        for i in loaded.indices {
            if let existingNote = notes.first(where: { $0.fileURL == loaded[i].fileURL }),
               pendingSaveNoteIDs.contains(existingNote.id) {
                loaded[i] = existingNote
            }
        }
        self.notes = loaded
    }

    // MARK: - Pin Toggle

    func togglePin(_ noteID: UUID) {
        guard let index = notes.firstIndex(where: { $0.id == noteID }) else { return }
        notes[index].isPinned.toggle()
        savePins()
    }

    // MARK: - Note CRUD

    func createNote() {
        var title = "Untitled"
        var counter = 1
        let existingTitles = Set(notes.map(\.title))
        while existingTitles.contains(title) {
            counter += 1
            title = "Untitled \(counter)"
        }

        let fileURL = notesDirectory.appendingPathComponent("\(title).md")
        let content = "# \(title)\n\n"

        do {
            try content.write(to: fileURL, atomically: true, encoding: .utf8)
            let note = Note(title: title, content: content, fileURL: fileURL)
            notes.append(note)
            selectedNoteID = note.id
        } catch {
            print("Failed to create note: \(error)")
        }
    }

    func deleteNote(_ note: Note) {
        do {
            try FileManager.default.removeItem(at: note.fileURL)
            let wasPinned = notes.first(where: { $0.id == note.id })?.isPinned ?? false
            notes.removeAll { $0.id == note.id }
            if wasPinned {
                savePins()
            }
            if selectedNoteID == note.id {
                selectedNoteID = filteredNotes.first?.id
            }
        } catch {
            print("Failed to delete note: \(error)")
        }
    }

    func updateNoteContent(_ noteID: UUID, content: String) {
        guard let index = notes.firstIndex(where: { $0.id == noteID }) else { return }
        notes[index].content = content
        notes[index].dateModified = Date()
        pendingSaveNoteIDs.insert(noteID)
        scheduleSave(for: notes[index])
    }

    func renameNote(_ noteID: UUID, newTitle: String) {
        guard let index = notes.firstIndex(where: { $0.id == noteID }) else { return }
        let oldURL = notes[index].fileURL
        let sanitized = sanitizeFileName(newTitle)
        let newURL = notesDirectory.appendingPathComponent("\(sanitized).md")

        guard oldURL != newURL else { return }

        do {
            try FileManager.default.moveItem(at: oldURL, to: newURL)
            notes[index].title = newTitle
            notes[index].fileURL = newURL
            notes[index].dateModified = Date()
            if notes[index].isPinned {
                savePins()
            }
        } catch {
            print("Failed to rename note: \(error)")
        }
    }

    private func scheduleSave(for note: Note) {
        saveTask?.cancel()
        saveTask = Task {
            try? await Task.sleep(nanoseconds: 1_000_000_000) // 1 second debounce
            guard !Task.isCancelled else { return }
            do {
                isSaving = true
                try note.content.write(to: note.fileURL, atomically: true, encoding: .utf8)
                pendingSaveNoteIDs.remove(note.id)
                // Brief delay so the file monitor event fires while isSaving is still true
                try? await Task.sleep(nanoseconds: 200_000_000)
                isSaving = false
            } catch {
                isSaving = false
                pendingSaveNoteIDs.remove(note.id)
                print("Failed to save note: \(error)")
            }
        }
    }

    private func sanitizeFileName(_ name: String) -> String {
        let allowed = CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "-_ "))
        let sanitized = name.unicodeScalars.filter { allowed.contains($0) }
        let result = String(String.UnicodeScalarView(sanitized)).trimmingCharacters(in: .whitespaces)
        return result.isEmpty ? "Untitled" : result
    }

    private func startMonitoring() {
        directoryDescriptor = open(notesDirectory.path, O_EVTONLY)
        guard directoryDescriptor != -1 else { return }

        fileMonitor = DispatchSource.makeFileSystemObjectSource(
            fileDescriptor: directoryDescriptor,
            eventMask: .write,
            queue: .main
        )

        fileMonitor?.setEventHandler { [weak self] in
            Task { @MainActor in
                guard let self, !self.isSaving else { return }
                self.loadNotes()
            }
        }

        fileMonitor?.setCancelHandler { [weak self] in
            if let fd = self?.directoryDescriptor, fd != -1 {
                close(fd)
                self?.directoryDescriptor = -1
            }
        }

        fileMonitor?.resume()
    }
}

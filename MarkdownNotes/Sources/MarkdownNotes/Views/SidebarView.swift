import SwiftUI

struct SidebarView: View {
    @ObservedObject var manager: NotesManager
    @State private var noteToDelete: Note?
    @State private var showDeleteConfirmation = false

    var body: some View {
        VStack(spacing: 0) {
            List(manager.filteredNotes, selection: $manager.selectedNoteID) { note in
                VStack(alignment: .leading, spacing: 2) {
                    HStack {
                        Text(note.title)
                            .font(.headline)
                            .lineLimit(1)
                        if note.isPinned {
                            Image(systemName: "pin.fill")
                                .font(.caption)
                                .foregroundStyle(.orange)
                        }
                    }
                    Text(note.dateModified, style: .relative)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Text(note.content.prefix(80).replacingOccurrences(of: "\n", with: " "))
                        .font(.caption)
                        .foregroundStyle(.tertiary)
                        .lineLimit(1)
                }
                .padding(.vertical, 2)
                .tag(note.id)
                .contextMenu {
                    Button(note.isPinned ? "Unpin" : "Pin") {
                        manager.togglePin(note.id)
                    }
                    Button("Delete", role: .destructive) {
                        noteToDelete = note
                        showDeleteConfirmation = true
                    }
                }
            }
            .listStyle(.sidebar)
        }
        .safeAreaInset(edge: .top) {
            VStack(spacing: 8) {
                TextField("Search notes...", text: $manager.searchText)
                    .textFieldStyle(.roundedBorder)
                    .padding(.horizontal, 8)
            }
            .padding(.vertical, 8)
            .background(.bar)
        }
        .toolbar {
            ToolbarItem(placement: .destructiveAction) {
                Button(action: {
                    if let id = manager.selectedNoteID,
                       let note = manager.notes.first(where: { $0.id == id }) {
                        noteToDelete = note
                        showDeleteConfirmation = true
                    }
                }) {
                    Label("Delete Note", systemImage: "trash")
                }
                .disabled(manager.selectedNoteID == nil)
            }
            ToolbarItem(placement: .primaryAction) {
                Button(action: { manager.createNote() }) {
                    Label("New Note", systemImage: "square.and.pencil")
                }
            }
        }
        .alert("Delete Note", isPresented: $showDeleteConfirmation, presenting: noteToDelete) { note in
            Button("Delete", role: .destructive) {
                manager.deleteNote(note)
            }
            Button("Cancel", role: .cancel) {}
        } message: { note in
            Text("Are you sure you want to delete \"\(note.title)\"? This cannot be undone.")
        }
    }
}

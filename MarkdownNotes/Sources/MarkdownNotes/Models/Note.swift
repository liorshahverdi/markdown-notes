import Foundation

struct Note: Identifiable, Hashable {
    let id: UUID
    var title: String
    var content: String
    var dateModified: Date
    var fileURL: URL
    var isPinned: Bool

    init(id: UUID = UUID(), title: String, content: String = "", dateModified: Date = Date(), fileURL: URL, isPinned: Bool = false) {
        self.id = id
        self.title = title
        self.content = content
        self.dateModified = dateModified
        self.fileURL = fileURL
        self.isPinned = isPinned
    }

    var sanitizedFileName: String {
        let allowed = CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "-_ "))
        let sanitized = title.unicodeScalars.filter { allowed.contains($0) }
        let name = String(String.UnicodeScalarView(sanitized)).trimmingCharacters(in: .whitespaces)
        return name.isEmpty ? "Untitled" : name
    }
}

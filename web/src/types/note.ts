export interface NoteRecord {
  id: string;        // UUID
  title: string;
  content: string;
  dateModified: number;  // timestamp ms
  isPinned: boolean;
  isShared?: boolean;
  ownerId?: string;
  ownerUsername?: string;
  folderId?: string | null;
  summary?: string | null;
  version?: number;
}

export interface FolderRecord {
  id: string;
  name: string;
  parentFolderId: string | null;
  dateCreated: number;
  dateModified: number;
  sortOrder: number;
}

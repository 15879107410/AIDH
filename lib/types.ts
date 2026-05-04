export type Folder = {
  id: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type Bookmark = {
  id: string;
  url: string;
  title: string;
  logoUrl: string;
  description: string;
  folderId: string | null;
  folderName?: string | null;
  pinned: boolean;
  pinnedOrder: number | null;
  visitCount: number;
  createdAt: string;
  updatedAt: string;
  tags: string[];
};

export type FolderNode = Folder & {
  count: number;
  children: FolderNode[];
};

export type AiPreview = {
  title: string;
  url: string;
  logoUrl: string;
  description: string;
  tags: string[];
  suggestedFolderId: string | null;
  suggestedFolderName: string | null;
  confidence: number;
  source: "mock" | "deepseek";
};

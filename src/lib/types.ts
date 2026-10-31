export type ViewMode = "details" | "icons" | "gallery";

export type SortKey = "name" | "modifiedAt" | "size" | "mimeType" | "driveAccountId";

export type DriveSummary = {
  id: string;
  email: string;
  label: string;
  color: string;
  status: string; // e.g. "active", "reconnect"
  usedBytes: number;
  totalBytes: number;
};

export type FolderPathItem = {
  id: string;
  name: string;
};

export type FolderPath = FolderPathItem[];

export type FileItem = {
  id: string;
  driveAccountId: string;
  name: string;
  title: string | null;
  mimeType: string;
  isFolder: boolean;
  size: number;
  hasThumbnail: boolean;
  webViewLink?: string | null;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  modifiedAt: Date | null;
  version?: string | null;
  trashed?: boolean;
  parentId: string | null;
};

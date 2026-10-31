export function formatBytes(bytes: number, decimals = 1) {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function formatDate(date: Date | string | null): string {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(d);
}

export function getFileLabel(mimeType: string, isFolder: boolean): string {
  if (isFolder) return "Folder";

  if (mimeType.startsWith("image/")) return "Image";
  if (mimeType.startsWith("video/")) return "Video";
  if (mimeType === "application/pdf") return "PDF Document";
  if (mimeType.includes("wordprocessingml")) return "Word Document";
  if (mimeType.includes("spreadsheetml")) return "Excel Spreadsheet";
  if (mimeType.includes("presentationml")) return "PowerPoint Presentation";
  if (mimeType.includes("google-apps.document")) return "Google Doc";
  if (mimeType.includes("google-apps.spreadsheet")) return "Google Sheet";
  if (mimeType.includes("google-apps.presentation")) return "Google Slides";
  if (mimeType.startsWith("text/")) return "Text Document";
  if (mimeType === "application/json") return "JSON File";

  return "File";
}

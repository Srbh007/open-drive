export type ViewerKind = "image" | "video" | "pdf" | "docx" | "sheet" | "code" | "none";

export function getViewerKind(mimeType: string): ViewerKind {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType === "application/pdf") return "pdf";

  if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return "docx";
  if (mimeType === "application/vnd.google-apps.document") return "docx"; // Fallback to docx preview if possible, otherwise will edit in Google

  if (mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || mimeType === "application/vnd.ms-excel") return "sheet";
  if (mimeType === "application/vnd.google-apps.spreadsheet") return "sheet";

  if (mimeType.startsWith("text/") ||
      mimeType === "application/json" ||
      mimeType === "application/javascript" ||
      mimeType === "application/xml") {
    return "code";
  }

  return "none";
}

export function isImage(mimeType: string): boolean {
  return getViewerKind(mimeType) === "image";
}

export function canEditInGoogle(mimeType: string): boolean {
  return [
    "application/vnd.google-apps.document",
    "application/vnd.google-apps.spreadsheet",
    "application/vnd.google-apps.presentation",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.ms-word",
    "application/vnd.ms-excel",
    "application/vnd.ms-powerpoint"
  ].includes(mimeType);
}

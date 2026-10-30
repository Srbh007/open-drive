import { describe, it, expect } from "vitest";
import { getViewerKind, isImage, canEditInGoogle } from "./viewers";

describe("viewers logic", () => {
  it("getViewerKind maps MIME types correctly", () => {
    expect(getViewerKind("image/jpeg")).toBe("image");
    expect(getViewerKind("video/mp4")).toBe("video");
    expect(getViewerKind("application/pdf")).toBe("pdf");
    expect(getViewerKind("application/vnd.openxmlformats-officedocument.wordprocessingml.document")).toBe("docx");
    expect(getViewerKind("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")).toBe("sheet");
    expect(getViewerKind("text/plain")).toBe("code");
    expect(getViewerKind("application/json")).toBe("code");
    expect(getViewerKind("application/octet-stream")).toBe("none");
  });

  it("isImage identifies images", () => {
    expect(isImage("image/png")).toBe(true);
    expect(isImage("video/mp4")).toBe(false);
  });

  it("canEditInGoogle identifies editable Google Docs/MS Office files", () => {
    expect(canEditInGoogle("application/vnd.google-apps.document")).toBe(true);
    expect(canEditInGoogle("application/vnd.openxmlformats-officedocument.wordprocessingml.document")).toBe(true);
    expect(canEditInGoogle("application/pdf")).toBe(false);
    expect(canEditInGoogle("text/plain")).toBe(false);
  });
});

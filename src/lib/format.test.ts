import { describe, it, expect } from "vitest";
import { formatBytes, formatDate, getFileLabel } from "./format";

describe("format logic", () => {
  it("formatBytes formats correctly", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1024)).toBe("1 KB");
    expect(formatBytes(1500)).toBe("1.5 KB");
    expect(formatBytes(1048576)).toBe("1 MB");
  });

  it("formatDate formats correctly", () => {
    const d = new Date("2024-01-01T12:30:00Z");
    // Depending on timezone, could be slightly different, using a regex or partial check
    expect(formatDate(d)).toContain("2024");
    expect(formatDate(null)).toBe("");
  });

  it("getFileLabel gets correct labels", () => {
    expect(getFileLabel("application/pdf", false)).toBe("PDF Document");
    expect(getFileLabel("any", true)).toBe("Folder");
    expect(getFileLabel("image/jpeg", false)).toBe("Image");
    expect(getFileLabel("application/vnd.google-apps.document", false)).toBe("Google Doc");
    expect(getFileLabel("application/octet-stream", false)).toBe("File");
  });
});

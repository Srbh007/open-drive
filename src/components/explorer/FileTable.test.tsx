import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FileTable } from "./FileTable";
import { FileItem, DriveSummary } from "@/lib/types";

// Mock useVirtualizer to render all items synchronously for testing
vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: (options: { count: number }) => ({
    getVirtualItems: () => Array.from({ length: options.count }).map((_, i) => ({
      index: i,
      key: String(i),
      size: 36,
      start: i * 36
    })),
    getTotalSize: () => options.count * 36,
  })
}));

const mockFiles: FileItem[] = [
  {
    id: "1", name: "A.txt", title: "A.txt", mimeType: "text/plain", size: 100, isFolder: false, driveAccountId: "d1", modifiedAt: new Date("2024-01-01"), hasThumbnail: false, webViewLink: null, width: null, height: null, durationMs: null, version: "1", trashed: false, providerFileId: "p1", parentProviderId: "root"
  },
  {
    id: "2", name: "B.txt", title: "B.txt", mimeType: "text/plain", size: 200, isFolder: false, driveAccountId: "d1", modifiedAt: new Date("2024-01-02"), hasThumbnail: false, webViewLink: null, width: null, height: null, durationMs: null, version: "1", trashed: false, providerFileId: "p2", parentProviderId: "root"
  }
];

const mockDrives: DriveSummary[] = [
  { id: "d1", email: "test@example.com", label: "Drive 1", color: "blue", status: "active", usedBytes: 0, totalBytes: 100 }
];

describe("FileTable", () => {
  it("renders files and headers", () => {
    const onSort = vi.fn();
    render(<FileTable files={mockFiles} drives={mockDrives} sortKey="name" sortDesc={false} onSort={onSort} selectedIds={new Set()} onSelect={vi.fn()} onOpen={vi.fn()} />);

    expect(screen.getAllByText("A.txt")[0]).toBeTruthy();
    expect(screen.getAllByText("B.txt")[0]).toBeTruthy();
  });

  it("calls onSort when header clicked", () => {
    const onSort = vi.fn();
    render(<FileTable files={mockFiles} drives={mockDrives} sortKey="name" sortDesc={false} onSort={onSort} selectedIds={new Set()} onSelect={vi.fn()} onOpen={vi.fn()} />);

    const headers = container.querySelectorAll('.border-b.h-9 > div');
    const nameHeader = Array.from(headers).find(el => el.textContent?.includes('Name'));
    fireEvent.click(nameHeader!);
    expect(onSort).toHaveBeenCalledWith("name");

    const sizeHeader = Array.from(headers).find(el => el.textContent?.includes('Size'));
    fireEvent.click(sizeHeader!);
    expect(onSort).toHaveBeenCalledWith("size");
  });

  it("calls onSelect when row clicked", () => {
    const onSelect = vi.fn();
    render(<FileTable files={mockFiles} drives={mockDrives} sortKey="name" sortDesc={false} onSort={vi.fn()} selectedIds={new Set()} onSelect={onSelect} onOpen={vi.fn()} />);

    const rowDiv = container.querySelector("div[style*='height: 36px']");
    fireEvent.click(rowDiv!);
    expect(onSelect).toHaveBeenCalledWith("1", false, false);
  });
});

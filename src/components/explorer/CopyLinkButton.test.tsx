import * as React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { CopyLinkButton } from "./CopyLinkButton";
import { FileItem } from "@/lib/types";
import { toast } from "sonner";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockFile = { id: "1", name: "A.txt", title: "A.txt" } as FileItem;

describe("CopyLinkButton", () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("copies to clipboard and shows success toast", async () => {
    const onCopy = vi.fn().mockResolvedValue("https://link.example");

    render(<CopyLinkButton file={mockFile} onCopy={onCopy} />);

    const btn = screen.getByRole("button");
    fireEvent.click(btn);

    await waitFor(() => {
      expect(onCopy).toHaveBeenCalledWith(mockFile);
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith("https://link.example");
      expect(toast.success).toHaveBeenCalledWith("Link copied");
    });
  });

  it("shows error toast on failure", async () => {
    const onCopy = vi.fn().mockRejectedValue(new Error("Network Error"));

    render(<CopyLinkButton file={mockFile} onCopy={onCopy} />);

    const btn = screen.getByRole("button");
    fireEvent.click(btn);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to copy link");
    });
  });
});

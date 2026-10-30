import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useMultiSelect } from "./use-multi-select";
import { FileItem } from "@/lib/types";

const files = [
  { id: "1" } as FileItem,
  { id: "2" } as FileItem,
  { id: "3" } as FileItem,
  { id: "4" } as FileItem,
];

describe("useMultiSelect", () => {
  it("selects a single item", () => {
    const { result } = renderHook(() => useMultiSelect(files));
    act(() => {
      result.current.handleSelect("1", false, false);
    });
    expect(result.current.selectedIds.has("1")).toBe(true);
    expect(result.current.selectedIds.size).toBe(1);
  });

  it("selects multiple items with ctrl/meta key", () => {
    const { result } = renderHook(() => useMultiSelect(files));
    act(() => {
      result.current.handleSelect("1", false, false);
      result.current.handleSelect("2", true, false);
    });
    expect(result.current.selectedIds.has("1")).toBe(true);
    expect(result.current.selectedIds.has("2")).toBe(true);
    expect(result.current.selectedIds.size).toBe(2);
  });

  it("selects a range of items with shift key", () => {
    const { result } = renderHook(() => useMultiSelect(files));
    act(() => {
      result.current.handleSelect("1", false, false);
      result.current.handleSelect("3", false, true);
    });
    expect(result.current.selectedIds.has("1")).toBe(true);
    expect(result.current.selectedIds.has("2")).toBe(true);
    expect(result.current.selectedIds.has("3")).toBe(true);
    expect(result.current.selectedIds.has("4")).toBe(false);
    expect(result.current.selectedIds.size).toBe(3);
  });
});

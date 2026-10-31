import * as React from "react";
import { FileItem } from "@/lib/types";

export function useMultiSelect(files: FileItem[]) {
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());

  const handleSelect = React.useCallback(
    (id: string, multi: boolean, range: boolean) => {
      setSelectedIds(prev => {
        if (multi) {
          const newSet = new Set(prev);
          if (newSet.has(id)) newSet.delete(id);
          else newSet.add(id);
          return newSet;
        } else if (range) {
          const idx = files.findIndex(f => f.id === id);
          const lastSelectedIdx = files.findIndex(f => prev.has(f.id));
          if (lastSelectedIdx !== -1 && idx !== -1) {
            const start = Math.min(idx, lastSelectedIdx);
            const end = Math.max(idx, lastSelectedIdx);
            const newSet = new Set(prev);
            for (let i = start; i <= end; i++) {
              newSet.add(files[i].id);
            }
            return newSet;
          }
          return new Set([id]);
        } else {
          return new Set([id]);
        }
      });
    },
    [files]
  );

  return { selectedIds, setSelectedIds, handleSelect };
}

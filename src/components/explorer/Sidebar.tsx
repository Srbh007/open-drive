import * as React from "react";

import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "@/lib/utils";
import { DriveSummary } from "@/lib/types";

interface SidebarProps {
  drives: DriveSummary[];
  onSelectDrive: (driveId: string) => void;
  selectedDriveId?: string;
  className?: string;
}

export function Sidebar({ drives, onSelectDrive, selectedDriveId, className }: SidebarProps) {
  const [filter, setFilter] = React.useState("");

  const filteredDrives = React.useMemo(() =>
    drives.filter(d => d.label.toLowerCase().includes(filter.toLowerCase()) || d.email.toLowerCase().includes(filter.toLowerCase())),
  [drives, filter]);

  const parentRef = React.useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: filteredDrives.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40,
    overscan: 5,
  });

  return (
    <div className={cn("flex flex-col h-full bg-surface border-r border-border w-[280px]", className)}>
      <div className="p-4 border-b border-border">
        <input
          type="text"
          placeholder="Filter drives..."
          className="w-full p-2 text-sm border border-border rounded-md bg-transparent text-text"
          value={filter}
          onChange={e => setFilter(e.target.value)}
        />
      </div>
      <div ref={parentRef} className="flex-1 overflow-auto p-2">
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualItem) => {
            const drive = filteredDrives[virtualItem.index];
            const isSelected = drive.id === selectedDriveId;
            const pct = Math.min(100, Math.max(0, (drive.usedBytes / drive.totalBytes) * 100)) || 0;
            const barColor = pct > 95 ? "bg-danger" : pct > 80 ? "bg-warning" : "bg-primary";

            return (
              <div
                key={virtualItem.key}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualItem.size}px`,
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                <div
                  className={cn(
                    "flex flex-col justify-center px-2 h-full rounded-md cursor-pointer hover:bg-surface-muted",
                    isSelected && "bg-surface-muted font-medium"
                  )}
                  onClick={() => onSelectDrive(drive.id)}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: drive.color }} />
                    <span className="truncate text-sm text-text flex-1">{drive.label}</span>
                  </div>
                  <div className="h-[3px] w-full bg-border rounded-full mt-1 overflow-hidden">
                    <div className={cn("h-full", barColor)} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

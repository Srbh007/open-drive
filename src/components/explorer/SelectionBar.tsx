import * as React from "react";
import { Copy, Download, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";


interface SelectionBarProps {
  selectedCount: number;
  onClear: () => void;
  onCopyLinks: () => void;
  onDownload: () => void;
  onDelete: () => void;
}

export function SelectionBar({ selectedCount, onClear, onCopyLinks, onDownload, onDelete }: SelectionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-surface text-text border border-border shadow-lg rounded-full px-4 py-2 flex items-center gap-4 z-50 animate-in fade-in slide-in-from-bottom-4">
      <span className="font-medium px-2 border-r border-border">{selectedCount} selected</span>

      <Button variant="ghost" size="sm" onClick={onCopyLinks} className="h-8 rounded-full">
        <Copy className="w-4 h-4 mr-2" /> Copy links
      </Button>

      <Button variant="ghost" size="sm" onClick={onDownload} className="h-8 rounded-full">
        <Download className="w-4 h-4 mr-2" /> Download
      </Button>

      <Button variant="ghost" size="sm" onClick={onDelete} className="h-8 rounded-full text-danger hover:text-danger hover:bg-danger/10">
        <Trash2 className="w-4 h-4 mr-2" /> Delete
      </Button>

      <Button variant="ghost" size="icon" onClick={onClear} className="h-8 w-8 rounded-full ml-2">
        <X className="w-4 h-4" />
      </Button>
    </div>
  );
}

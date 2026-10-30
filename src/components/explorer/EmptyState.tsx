import * as React from "react";
import { FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  onUpload: () => void;
}

export function EmptyState({ onUpload }: EmptyStateProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-surface">
      <div className="w-16 h-16 bg-surface-muted rounded-full flex items-center justify-center mb-4">
        <FolderOpen className="w-8 h-8 text-text-muted" />
      </div>
      <h3 className="text-lg font-semibold text-text mb-1">This folder is empty</h3>
      <p className="text-text-muted mb-6">Drag and drop files here to upload</p>
      <Button onClick={onUpload}>Upload files</Button>
    </div>
  );
}

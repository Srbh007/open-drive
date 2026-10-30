import * as React from "react";
import { ChevronRight } from "lucide-react";
import { FolderPath } from "@/lib/types";

interface BreadcrumbsProps {
  path: FolderPath;
  onNavigate: (folderId: string) => void;
}

export function Breadcrumbs({ path, onNavigate }: BreadcrumbsProps) {
  return (
    <div className="flex items-center text-sm text-text-muted overflow-hidden whitespace-nowrap h-12 px-4">
      {path.map((item, index) => (
        <React.Fragment key={item.id}>
          <button
            className="hover:text-text hover:bg-surface-muted px-2 py-1 rounded transition-colors truncate max-w-[150px]"
            onClick={() => onNavigate(item.id)}
          >
            {item.name}
          </button>
          {index < path.length - 1 && <ChevronRight className="w-4 h-4 mx-1 flex-shrink-0" />}
        </React.Fragment>
      ))}
    </div>
  );
}

import * as React from "react";
import { FileItem } from "@/lib/types";
import {
  ContextMenu as ContextMenuRoot,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger
} from "@/components/ui/context-menu";
import { ExternalLink, Copy, Link2, Pencil, Trash2, Download, FolderPlus, UploadCloud } from "lucide-react";
import { canEditInGoogle } from "@/lib/viewers";

interface ContextMenuProps {
  children: React.ReactNode;
  file?: FileItem; // if undefined, it's the empty space context menu
  onAction: (action: string, file?: FileItem) => void;
}

export function ContextMenu({ children, file, onAction }: ContextMenuProps) {
  if (file) {
    const isGoogleEdit = canEditInGoogle(file.mimeType);
    const isImage = file.mimeType.startsWith("image/");

    return (
      <ContextMenuRoot>
        <ContextMenuTrigger>{children}</ContextMenuTrigger>
        <ContextMenuContent className="w-56">
          <ContextMenuItem onClick={() => onAction("open", file)}>
            <ExternalLink className="mr-2 h-4 w-4" /> Open
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onAction("preview", file)}>
            Preview
          </ContextMenuItem>
          {!file.isFolder && (
            <ContextMenuItem onClick={() => onAction("download", file)}>
              <Download className="mr-2 h-4 w-4" /> Download
            </ContextMenuItem>
          )}
          <ContextMenuSeparator />

          <ContextMenuItem onClick={() => onAction("copy-link", file)}>
            <Link2 className="mr-2 h-4 w-4" /> Copy link
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onAction("copy-view-link", file)}>
            Copy view-only link
          </ContextMenuItem>
          {isImage && (
            <ContextMenuItem onClick={() => onAction("copy-image-link", file)}>
              Copy image link
            </ContextMenuItem>
          )}

          {isGoogleEdit && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem onClick={() => onAction("edit-google", file)}>
                Edit in Google
              </ContextMenuItem>
            </>
          )}

          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => onAction("rename", file)}>
            <Pencil className="mr-2 h-4 w-4" /> Rename
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onAction("move", file)}>
            Move to...
          </ContextMenuItem>

          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => onAction("delete", file)} className="text-red-600 focus:text-red-600">
            <Trash2 className="mr-2 h-4 w-4" /> Delete
          </ContextMenuItem>

          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => onAction("properties", file)}>
            Properties
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenuRoot>
    );
  }

  // Empty space context menu
  return (
    <ContextMenuRoot>
      <ContextMenuTrigger>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuItem onClick={() => onAction("new-folder")}>
          <FolderPlus className="mr-2 h-4 w-4" /> New folder
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onAction("upload-files")}>
          <UploadCloud className="mr-2 h-4 w-4" /> Upload files
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => onAction("sort")}>
          Sort by
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onAction("view")}>
          View
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenuRoot>
  );
}

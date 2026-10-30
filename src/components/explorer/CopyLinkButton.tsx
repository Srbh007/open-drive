import * as React from "react";
import { Link2 } from "lucide-react";
import { FileItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface CopyLinkButtonProps {
  file: FileItem;
  onCopy: (file: FileItem) => Promise<string>;
  className?: string;
}

export function CopyLinkButton({ file, onCopy, className }: CopyLinkButtonProps) {
  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      const link = await onCopy(file);
      await navigator.clipboard.writeText(link);
      toast.success("Link copied");
    } catch (err) {
      toast.error("Failed to copy link");
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className={className}
      onClick={handleCopy}
      title="Copy link"
    >
      <Link2 className="h-4 w-4" />
    </Button>
  );
}

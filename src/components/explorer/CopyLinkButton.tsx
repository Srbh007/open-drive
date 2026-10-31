import * as React from "react";
import { Link2 } from "lucide-react";
import { FileItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface CopyLinkButtonProps {
  file: FileItem;
  className?: string;
  kind?: "edit" | "view" | "image";
}

export function CopyLinkButton({ file, className, kind }: CopyLinkButtonProps) {
  const [loading, setLoading] = React.useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    try {
      const res = await fetch("/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId: file.id, kind }),
      });
      const data = await res.json();
      
      if (!data.ok) throw new Error(data.error?.message || "Failed to create link");
      
      const linkUrl = `${window.location.origin}/s/${data.data.slug}`;
      await navigator.clipboard.writeText(linkUrl);
      
      const returnedKind = data.data.kind;
      toast.success(`Link copied — anyone can ${returnedKind}`);
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to copy link");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className={className}
      onClick={handleCopy}
      title="Copy link"
      disabled={loading}
    >
      <Link2 className="h-4 w-4" />
    </Button>
  );
}

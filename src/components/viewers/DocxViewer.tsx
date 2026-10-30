import * as React from "react";
import { FileItem } from "@/lib/types";
import { renderAsync } from "docx-preview";

interface DocxViewerProps {
  file: FileItem;
}

export function DocxViewer({ file }: DocxViewerProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);

    async function loadDocx() {
      try {
        const res = await fetch(`/api/stream/${file.id}`);
        if (!res.ok) throw new Error("Failed to fetch docx");
        const arrayBuffer = await res.arrayBuffer();
        if (active && containerRef.current) {
          await renderAsync(arrayBuffer, containerRef.current, undefined, {
            inWrapper: false,
            ignoreWidth: false,
            ignoreHeight: false,
            ignoreFonts: false,
            breakPages: true,
          });
          setLoading(false);
        }
      } catch (err) {
        console.error(err);
        if (active) {
          setError(true);
          setLoading(false);
        }
      }
    }
    loadDocx();

    return () => { active = false; };
  }, [file.id]);

  return (
    <div className="w-full h-full bg-white overflow-auto rounded text-black relative flex justify-center">
      {loading && <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10 text-gray-500">Loading document...</div>}
      {error && <div className="absolute inset-0 flex items-center justify-center bg-white z-10 text-red-500">Failed to render document. Please try downloading it.</div>}
      <div ref={containerRef} className="max-w-[800px] w-full p-4" />
    </div>
  );
}

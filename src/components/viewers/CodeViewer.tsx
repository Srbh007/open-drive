import * as React from "react";
import { FileItem } from "@/lib/types";
import { createHighlighter } from "shiki";

interface CodeViewerProps {
  file: FileItem;
}

export function CodeViewer({ file }: CodeViewerProps) {
  const [html, setHtml] = React.useState<string>("");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);
  const [wrap, setWrap] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);

    async function loadCode() {
      try {
        const res = await fetch(`/api/stream/${file.id}`);
        if (!res.ok) throw new Error("Failed to fetch code");
        const text = await res.text();

        if (active) {
          let lang = "text";
          if (file.name.endsWith(".json") || file.mimeType === "application/json") lang = "json";
          else if (file.name.endsWith(".js") || file.mimeType === "application/javascript") lang = "javascript";
          else if (file.name.endsWith(".ts")) lang = "typescript";
          else if (file.name.endsWith(".html")) lang = "html";
          else if (file.name.endsWith(".css")) lang = "css";

          const highlighter = await createHighlighter({
            themes: ['github-dark'],
            langs: [lang, 'text'],
          });

          const highlighted = highlighter.codeToHtml(text, { lang, theme: 'github-dark' });
          setHtml(highlighted);
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
    loadCode();

    return () => { active = false; };
  }, [file.id, file.name, file.mimeType]);

  return (
    <div className="w-full h-full flex flex-col bg-[#24292e] text-white rounded overflow-hidden relative">
      <div className="absolute top-2 right-4 z-10">
        <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer hover:text-white bg-black/50 px-2 py-1 rounded">
          <input type="checkbox" checked={wrap} onChange={e => setWrap(e.target.checked)} className="rounded" />
          Word Wrap
        </label>
      </div>

      {loading && <div className="flex-1 flex items-center justify-center text-gray-400">Loading file...</div>}
      {error && <div className="flex-1 flex items-center justify-center text-red-400">Failed to load text. Please try downloading it.</div>}

      {!loading && !error && (
        <div className={`flex-1 overflow-auto p-4 text-[13px] font-mono leading-[1.5] ${wrap ? 'whitespace-pre-wrap word-break-all' : 'whitespace-pre'}`}>
          <style>{`
            .shiki { background-color: transparent !important; padding: 0; margin: 0; }
            ${wrap ? '.shiki code { white-space: pre-wrap !important; word-break: break-all; }' : ''}
          `}</style>
          <div dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      )}
    </div>
  );
}

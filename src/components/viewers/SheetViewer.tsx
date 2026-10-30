import * as React from "react";
import { FileItem } from "@/lib/types";
import * as XLSX from "xlsx";

interface SheetViewerProps {
  file: FileItem;
}

export function SheetViewer({ file }: SheetViewerProps) {
  const [workbook, setWorkbook] = React.useState<XLSX.WorkBook | null>(null);
  const [activeSheet, setActiveSheet] = React.useState<string>("");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);

    async function loadSheet() {
      try {
        const res = await fetch(`/api/stream/${file.id}`);
        if (!res.ok) throw new Error("Failed to fetch sheet");
        const arrayBuffer = await res.arrayBuffer();
        if (active) {
          const wb = XLSX.read(arrayBuffer, { type: "array" });
          setWorkbook(wb);
          if (wb.SheetNames.length > 0) {
            setActiveSheet(wb.SheetNames[0]);
          }
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
    loadSheet();

    return () => { active = false; };
  }, [file.id]);

  const renderSheet = () => {
    if (!workbook || !activeSheet) return null;
    const ws = workbook.Sheets[activeSheet];
    const html = XLSX.utils.sheet_to_html(ws);

    // Very basic rendering. For virtualization, we would use sheet_to_json and react-virtual.
    // Given the constraints and to keep it simple initially, we inject HTML.
    return (
      <div
        className="w-full h-full overflow-auto bg-white p-4"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  };

  return (
    <div className="w-full h-full flex flex-col bg-white text-black rounded overflow-hidden">
      {loading && <div className="flex-1 flex items-center justify-center text-gray-500">Loading spreadsheet...</div>}
      {error && <div className="flex-1 flex items-center justify-center text-red-500">Failed to render spreadsheet. Please try downloading it.</div>}

      {!loading && !error && (
        <>
          <div className="flex-1 overflow-hidden relative sheet-viewer-content">
             <style>{`
               .sheet-viewer-content table { border-collapse: collapse; width: max-content; }
               .sheet-viewer-content td, .sheet-viewer-content th { border: 1px solid #e5e7eb; padding: 4px 8px; font-size: 13px; font-family: sans-serif; white-space: nowrap; }
               .sheet-viewer-content tr:first-child td { font-weight: 600; background: #f3f4f6; position: sticky; top: 0; z-index: 10; }
             `}</style>
             {renderSheet()}
          </div>
          <div className="h-10 border-t border-gray-200 bg-gray-50 flex items-center px-2 gap-1 overflow-x-auto shrink-0">
            {workbook?.SheetNames.map(name => (
              <button
                key={name}
                className={`px-4 py-1.5 text-sm font-medium rounded-t-sm border border-b-0 whitespace-nowrap ${name === activeSheet ? 'bg-white border-gray-300 text-blue-600 shadow-sm' : 'bg-transparent border-transparent text-gray-600 hover:bg-gray-200'}`}
                onClick={() => setActiveSheet(name)}
              >
                {name}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

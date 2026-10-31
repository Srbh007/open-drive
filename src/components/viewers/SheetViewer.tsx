import * as React from "react";
import { FileItem } from "@/lib/types";
import * as XLSX from "xlsx";
import { useVirtualizer } from "@tanstack/react-virtual";

interface SheetViewerProps {
  file: FileItem;
  src: string;
}

export function SheetViewer({ src }: SheetViewerProps) {
  const [workbook, setWorkbook] = React.useState<XLSX.WorkBook | null>(null);
  const [activeSheet, setActiveSheet] = React.useState<string>("");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);
  const [isTruncated, setIsTruncated] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    setIsTruncated(false);

    async function loadSheet() {
      try {
        const res = await fetch(src);
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
  }, [src]);

  // Derived state for the active sheet
  const { sheetData, columnLetters } = React.useMemo(() => {
    if (!workbook || !activeSheet) return { sheetData: [], headers: [], columnLetters: [] };
    const ws = workbook.Sheets[activeSheet];
    const data = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false, defval: "" });

    let truncated = false;
    let finalData = data;
    if (data.length > 50000) {
      finalData = data.slice(0, 50000);
      truncated = true;
    }

    // Find the max row length to know how many columns we have
    const maxCols = finalData.reduce((max, row) => Math.max(max, row.length), 0);

    const colLetters = Array.from({ length: maxCols }).map((_, i) => getColumnLetter(i));

    setIsTruncated(truncated);

    return { sheetData: finalData, headers: Array.from({ length: maxCols }), columnLetters: colLetters };
  }, [workbook, activeSheet]);

  const parentRef = React.useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: sheetData.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 24,
    overscan: 10,
  });

  return (
    <div className="w-full h-full flex flex-col bg-white text-black rounded overflow-hidden">
      {loading && <div className="flex-1 flex items-center justify-center text-gray-500">Loading spreadsheet...</div>}
      {error && <div className="flex-1 flex items-center justify-center text-red-500">Failed to render spreadsheet. Please try downloading it.</div>}

      {!loading && !error && (
        <>
          {isTruncated && (
            <div className="bg-yellow-100 text-yellow-800 px-4 py-2 text-sm border-b border-yellow-200">
              Notice: This sheet has been truncated to 50,000 rows for performance.
            </div>
          )}
          <div ref={parentRef} className="flex-1 overflow-auto relative sheet-viewer-content bg-gray-50 text-[13px] font-sans">
             <div className="min-w-max">
               {/* Sticky Headers */}
               <div className="sticky top-0 z-20 flex bg-gray-100 border-b border-gray-300 font-semibold text-center select-none text-gray-600">
                 {/* Corner cell */}
                 <div className="w-10 shrink-0 border-r border-gray-300 bg-gray-200 sticky left-0 z-30" />
                 {columnLetters.map((letter, i) => (
                   <div key={i} className="w-24 shrink-0 px-2 py-1 border-r border-gray-300">
                     {letter}
                   </div>
                 ))}
               </div>

               {/* Virtualized Rows */}
               <div
                 style={{
                   height: `${rowVirtualizer.getTotalSize()}px`,
                   width: '100%',
                   position: 'relative',
                 }}
               >
                 {rowVirtualizer.getVirtualItems().map((virtualItem) => {
                   const row = sheetData[virtualItem.index];
                   return (
                     <div
                       key={virtualItem.key}
                       className="absolute top-0 left-0 w-full flex bg-white border-b border-gray-200"
                       style={{
                         height: `${virtualItem.size}px`,
                         transform: `translateY(${virtualItem.start}px)`,
                       }}
                     >
                       {/* Row Number (sticky left) */}
                       <div className="w-10 shrink-0 bg-gray-100 border-r border-gray-300 flex items-center justify-center text-gray-500 font-medium select-none sticky left-0 z-10">
                         {virtualItem.index + 1}
                       </div>

                       {/* Cells */}
                       {columnLetters.map((_, colIndex) => {
                         const cellValue = String(row[colIndex] ?? "");
                         return (
                           <div
                             key={colIndex}
                             className="w-24 shrink-0 px-2 flex items-center border-r border-gray-200 overflow-hidden whitespace-nowrap text-ellipsis"
                             title={cellValue}
                           >
                             {cellValue}
                           </div>
                         );
                       })}
                     </div>
                   );
                 })}
               </div>
             </div>
          </div>

          {/* Sheet Tabs */}
          <div className="h-10 border-t border-gray-300 bg-gray-100 flex items-end px-2 gap-1 overflow-x-auto shrink-0 pt-1">
            {workbook?.SheetNames.map(name => (
              <button
                key={name}
                className={`px-4 py-1.5 text-sm font-medium rounded-t border border-b-0 whitespace-nowrap transition-colors ${
                  name === activeSheet
                    ? 'bg-white border-gray-300 text-blue-600 shadow-[0_1px_0_white] z-10'
                    : 'bg-gray-200 border-transparent text-gray-600 hover:bg-gray-300'
                }`}
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

export function getColumnLetter(colIndex: number): string {
  let letter = "";
  let temp = colIndex;
  while (temp >= 0) {
    letter = String.fromCharCode(65 + (temp % 26)) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

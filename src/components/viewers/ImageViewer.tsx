import * as React from "react";
import { FileItem } from "@/lib/types";

interface ImageViewerProps {
  file: FileItem;
  src: string;
}

export function ImageViewer({ file, src }: ImageViewerProps) {
  const [zoom, setZoom] = React.useState(1);
  const [position, setPosition] = React.useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = React.useState(false);
  const [dragStart, setDragStart] = React.useState({ x: 0, y: 0 });

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomDelta = e.deltaY * -0.01;
    setZoom(z => Math.min(Math.max(0.1, z + zoomDelta), 10));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <div
      className="w-full h-full flex items-center justify-center overflow-hidden relative select-none"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <img
        src={src}
        alt={file.name}
        style={{
          transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
          transition: isDragging ? 'none' : 'transform 0.1s',
          cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'auto'
        }}
        className="max-w-full max-h-full object-contain pointer-events-none"
      />
      <div className="absolute bottom-4 right-4 bg-black/50 text-white px-2 py-1 rounded text-sm backdrop-blur-sm">
        {Math.round(zoom * 100)}%
      </div>
    </div>
  );
}

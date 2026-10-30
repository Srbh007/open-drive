import * as React from "react";
import { FileItem } from "@/lib/types";

interface VideoPlayerProps {
  file: FileItem;
}

export function VideoPlayer({ file }: VideoPlayerProps) {
  const videoRef = React.useRef<HTMLVideoElement>(null);

  // Speed and PiP controls can be handled via native controls or custom overlay if preferred,
  // native controls usually provide PiP and playback rate.

  return (
    <div className="w-full h-full flex items-center justify-center bg-black">
      <video
        ref={videoRef}
        src={`/api/stream/${file.id}`}
        controls
        autoPlay
        className="max-w-full max-h-full"
      />
    </div>
  );
}

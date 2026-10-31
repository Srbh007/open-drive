'use client';

import { useQuery } from '@tanstack/react-query';
import { FileGrid } from '@/components/explorer/FileGrid';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { FileItem } from '@/lib/types';

export default function FavoritesPage() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data: files, isLoading, error } = useQuery<FileItem[]>({
    queryKey: ['favorites'],
    queryFn: async () => {
      const res = await fetch('/api/favorites');
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error?.message || 'Failed to load');
      return json.data;
    },
  });

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-text-muted" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full w-full items-center justify-center flex-col text-danger gap-2">
        <AlertCircle className="h-8 w-8" />
        <p>Failed to load favorites.</p>
      </div>
    );
  }

  return (
    <div className="p-6 flex flex-col h-full w-full">
      <h1 className="text-2xl font-bold mb-6">Favorites</h1>

      {(!files || files.length === 0) ? (
        <div className="flex-1 flex flex-col items-center justify-center text-text-muted">
           <p>No favorite files yet.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <FileGrid
            files={files}
            onSelect={(id, multi) => {
               if (multi) {
                 const newSet = new Set(selectedIds);
                 if (newSet.has(id)) newSet.delete(id);
                 else newSet.add(id);
                 setSelectedIds(newSet);
               } else {
                 setSelectedIds(new Set([id]));
               }
            }}
            selectedIds={selectedIds}
            onOpen={() => {}}

          />
        </div>
      )}
    </div>
  );
}

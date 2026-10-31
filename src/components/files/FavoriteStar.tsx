'use client';
import { useState } from 'react';
import { toast } from 'sonner';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

export function FavoriteStar({ fileId, initialFavorite, canEdit }: { fileId: string; initialFavorite: boolean; canEdit: boolean }) {
  const [isFav, setIsFav] = useState(initialFavorite);
  const [isLoading, setIsLoading] = useState(false);

  const toggle = async () => {
    if (!canEdit || isLoading) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/files/${fileId}/annotations`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ favorite: !isFav }),
      });
      if (!res.ok) throw new Error('Failed to save');
      setIsFav(!isFav);
    } catch (e) {
      toast.error('Could not update favorite');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Star
      className={cn("h-5 w-5 transition-colors", canEdit ? "cursor-pointer hover:scale-110" : "", isFav ? "fill-warning text-warning" : "text-text-muted hover:text-text")}
      onClick={toggle}
    />
  );
}

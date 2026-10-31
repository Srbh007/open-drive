'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export function CaptionEditor({ fileId, initialCaption, canEdit }: { fileId: string; initialCaption: string | null; canEdit: boolean }) {
  const [caption, setCaption] = useState(initialCaption || '');
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const save = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/files/${fileId}/annotations`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caption }),
      });
      if (!res.ok) throw new Error('Failed to save caption');
      setIsEditing(false);
      toast.success('Caption saved');
    } catch {
      toast.error('Could not save caption');
    } finally {
      setIsLoading(false);
    }
  };

  if (!canEdit) {
    return <div className="text-sm text-text-muted">{initialCaption || 'No caption'}</div>;
  }

  if (isEditing) {
    return (
      <div className="flex gap-2 items-center">
        <Input
          value={caption}
          onChange={e => setCaption(e.target.value)}
          maxLength={500}
          disabled={isLoading}
          onKeyDown={e => { if(e.key === 'Enter') save(); if(e.key === 'Escape') { setCaption(initialCaption||''); setIsEditing(false); } }}
        />
        <Button size="sm" onClick={save} disabled={isLoading}>Save</Button>
      </div>
    );
  }

  return (
    <div className="group flex gap-2 items-center text-sm">
      <span className={caption ? '' : 'text-text-muted italic'}>{caption || 'Add a caption...'}</span>
      <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 h-6 px-2" onClick={() => setIsEditing(true)}>Edit</Button>
    </div>
  );
}

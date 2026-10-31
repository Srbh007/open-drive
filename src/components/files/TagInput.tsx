'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';

export function TagInput({ fileId, initialTags, canEdit }: { fileId: string; initialTags: string[]; canEdit: boolean }) {
  const [tags, setTags] = useState<string[]>(initialTags || []);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const save = async (newTags: string[]) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/files/${fileId}/annotations`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: newTags }),
      });
      if (!res.ok) throw new Error('Failed to save tags');
      setTags(newTags);
    } catch (e) {
      toast.error('Could not save tags');
    } finally {
      setIsLoading(false);
    }
  };

  const addTag = () => {
    const val = input.trim().toLowerCase();
    if (!val || tags.includes(val)) return;
    if (val.length > 40) return toast.error('Tag too long (max 40)');
    if (tags.length >= 20) return toast.error('Max 20 tags');

    setInput('');
    save([...tags, val]);
  };

  const removeTag = (t: string) => {
    save(tags.filter(tag => tag !== t));
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1">
        {tags.map(t => (
          <Badge key={t} variant="secondary" className="flex items-center gap-1">
            {t}
            {canEdit && (
              <X className="h-3 w-3 cursor-pointer hover:text-danger" onClick={() => removeTag(t)} />
            )}
          </Badge>
        ))}
        {tags.length === 0 && !canEdit && <span className="text-sm text-text-muted">No tags</span>}
      </div>
      {canEdit && (
        <div className="flex gap-2">
          <Input
             value={input}
             onChange={e => setInput(e.target.value)}
             placeholder="Add tag..."
             className="h-8 text-sm"
             disabled={isLoading}
             onKeyDown={e => { if(e.key === 'Enter') addTag(); }}
          />
          <Button size="sm" variant="outline" onClick={addTag} disabled={isLoading || !input.trim()}>Add</Button>
        </div>
      )}
    </div>
  );
}

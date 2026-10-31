import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { CopyLinkButton } from './CopyLinkButton';
import { FileItem } from '@/lib/types';
import { toast } from 'sonner';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockFile: FileItem = {
  id: '123',
  name: 'test.jpg',
  mimeType: 'image/jpeg',
  isFolder: false,
  size: 100,
  hasThumbnail: false,
  width: null,
  height: null,
  durationMs: null,
  modifiedAt: null,
  driveAccountId: 'drive-id',
  title: 'test title',
  parentId: 'parent-id',
};

test('CopyLinkButton calls API and shows success toast', async () => {
  global.fetch = vi.fn().mockResolvedValue({
    json: () => Promise.resolve({ ok: true, data: { slug: 'test-slug', kind: 'edit' } }),
  });

  const writeTextMock = vi.fn().mockResolvedValue(undefined);
  Object.assign(navigator, {
    clipboard: {
      writeText: writeTextMock,
    },
  });

  render(<CopyLinkButton file={mockFile} />);
  const button = screen.getByRole('button');
  fireEvent.click(button);

  await waitFor(() => {
    expect(global.fetch).toHaveBeenCalledWith('/api/links', expect.any(Object));
    expect(writeTextMock).toHaveBeenCalledWith(expect.stringContaining('/s/test-slug'));
    expect(toast.success).toHaveBeenCalledWith('Link copied — anyone can edit');
  });
});

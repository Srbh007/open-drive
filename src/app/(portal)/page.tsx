'use client';

import { useQuery } from '@tanstack/react-query';
import { formatBytes } from '@/lib/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileGrid } from '@/components/explorer/FileGrid';
import { AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

export default function DashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const res = await fetch('/api/dashboard');
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
        <p>Failed to load dashboard.</p>
      </div>
    );
  }

  const { drives, totalStorage, recentFiles } = data;


  return (
    <div className="p-6 flex flex-col gap-8 max-w-5xl mx-auto w-full">
      <div>
        <h1 className="text-2xl font-bold mb-4">Dashboard</h1>

        <div className="mb-8">
          <div className="flex justify-between items-end mb-2">
            <span className="text-sm font-medium">Total Storage</span>
            <span className="text-sm text-text-muted">
              {formatBytes(totalStorage.used)} / {totalStorage.total > 0 ? formatBytes(totalStorage.total) : 'Unlimited'}
            </span>
          </div>
          <div className="h-3 w-full bg-surface-muted rounded-full overflow-hidden flex">
            {drives.map((drive: { id: string, label: string, email: string, color: string, quotaUsed: string | number, quotaTotal: string | number | null, status: string | null }) => {
              const w = totalStorage.total > 0 ? (Number(drive.quotaUsed) / totalStorage.total) * 100 : 0;
              return (
                <div
                  key={drive.id}
                  style={{ width: `${w}%`, backgroundColor: drive.color }}
                  className="h-full"
                  title={`${drive.label} (${formatBytes(Number(drive.quotaUsed))})`}
                />
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {drives.map((drive: { id: string, label: string, email: string, color: string, quotaUsed: string | number, quotaTotal: string | number | null, status: string | null }) => (
            <Link key={drive.id} href={`/drive?drive=${drive.id}`}>
              <Card className="hover:bg-surface-muted transition-colors cursor-pointer border-border shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: drive.color }} />
                    <span className="truncate">{drive.label}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-text-muted mb-4 truncate">{drive.email}</p>
                  <div className="mb-2">
                     <div className="flex justify-between items-end mb-1 text-xs">
                        <span>Storage</span>
                        <span>{formatBytes(Number(drive.quotaUsed))} {drive.quotaTotal ? `/ ${formatBytes(Number(drive.quotaTotal))}` : ''}</span>
                     </div>
                     <div className="h-1.5 w-full bg-surface-muted rounded-full overflow-hidden">
                       <div
                         className={cn("h-full", drive.quotaTotal && (Number(drive.quotaUsed) / Number(drive.quotaTotal) > 0.95) ? "bg-danger" : drive.quotaTotal && (Number(drive.quotaUsed) / Number(drive.quotaTotal) > 0.8) ? "bg-warning" : "bg-primary")}
                         style={{ width: drive.quotaTotal ? `${(Number(drive.quotaUsed) / Number(drive.quotaTotal)) * 100}%` : '100%' }}
                       />
                     </div>
                  </div>
                  <div className="flex justify-between text-xs text-text-muted mt-3">
                    <span>Sync: {drive.status || 'idle'}</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold mb-4">Recent Files</h2>
        {recentFiles.length > 0 ? (
          <FileGrid
             files={recentFiles}
             onSelect={() => {}}
             selectedIds={new Set()}
             onOpen={() => {}}

          />
        ) : (
          <p className="text-text-muted text-sm">No recent files.</p>
        )}
      </div>
    </div>
  );
}

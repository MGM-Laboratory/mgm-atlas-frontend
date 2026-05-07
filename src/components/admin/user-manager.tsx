'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, ShieldCheck, ShieldOff } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api/client';
import { apiPaths } from '@/lib/api/paths';
import { formatRelative } from '@/lib/utils';

interface AdminUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  isAdmin: boolean;
  createdAt: string;
}

export function UserManager() {
  const qc = useQueryClient();
  const { show } = useToast();
  const [search, setSearch] = React.useState('');

  const list = useQuery({
    queryKey: ['users', 'admin', search],
    queryFn: () =>
      api<{ items: AdminUser[]; meta: { total: number } }>(
        `/users?q=${encodeURIComponent(search)}&pageSize=50`,
      ),
  });

  const setAdmin = useMutation({
    mutationFn: (vars: { id: string; isAdmin: boolean }) =>
      api(apiPaths.setAdmin(vars.id), { method: 'PATCH', body: { isAdmin: vars.isAdmin } }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['users'] });
      show({
        tone: 'success',
        title: vars.isAdmin ? 'Admin role granted' : 'Admin role revoked',
      });
    },
    onError: (err) =>
      show({ tone: 'danger', title: 'Action failed', description: (err as Error).message }),
  });

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-h2 tracking-[-0.01em] text-ink">Users</h2>
          <p className="mt-1 text-body-sm text-ink-2">
            {list.data?.meta.total ?? '—'} authenticated members.
          </p>
        </div>
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-3" />
          <Input
            value={search}
            placeholder="Search by name or email"
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {list.isLoading ? (
        <Skeleton className="h-64 rounded-lg" />
      ) : (
        <div className="overflow-hidden rounded-lg border border-line bg-white">
          <table className="w-full text-[14px]">
            <thead className="bg-surface-muted text-[12px] uppercase tracking-[0.05em] text-ink-3">
              <tr>
                <th className="px-5 py-3 text-left font-medium">Member</th>
                <th className="px-5 py-3 text-left font-medium">Role</th>
                <th className="px-5 py-3 text-left font-medium">Joined</th>
                <th className="px-5 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {list.data!.items.map((u) => (
                <tr key={u.id} className="hover:bg-surface-muted/40">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar src={u.avatarUrl} name={u.name} size={32} />
                      <div className="min-w-0">
                        <div className="truncate font-medium text-ink">{u.name}</div>
                        <div className="truncate text-[12px] text-ink-3">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    {u.isAdmin ? <Badge tone="info">Admin</Badge> : <Badge tone="neutral">Member</Badge>}
                  </td>
                  <td className="px-5 py-3 text-ink-3">{formatRelative(u.createdAt)}</td>
                  <td className="px-5 py-3 text-right">
                    {u.isAdmin ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setAdmin.mutate({ id: u.id, isAdmin: false })}
                        loading={setAdmin.isPending && setAdmin.variables?.id === u.id}
                      >
                        <ShieldOff className="h-3.5 w-3.5" strokeWidth={2.25} />
                        Revoke admin
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setAdmin.mutate({ id: u.id, isAdmin: true })}
                        loading={setAdmin.isPending && setAdmin.variables?.id === u.id}
                      >
                        <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2.25} />
                        Make admin
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api/client';
import { apiPaths } from '@/lib/api/paths';
import type { CollaborationRole } from '@/lib/types';

export function CollaborationRoleManager() {
  const qc = useQueryClient();
  const { show } = useToast();
  const [name, setName] = React.useState('');

  const list = useQuery({
    queryKey: ['admin', 'collaboration-roles'],
    queryFn: () => api<CollaborationRole[]>(apiPaths.collaborationRoles()),
  });

  const create = useMutation({
    mutationFn: () =>
      api(apiPaths.collaborationRoles(), { method: 'POST', body: { name: name.trim() } }),
    onSuccess: () => {
      setName('');
      qc.invalidateQueries({ queryKey: ['admin', 'collaboration-roles'] });
      show({ tone: 'success', title: 'Role added' });
    },
  });

  const archive = useMutation({
    mutationFn: (id: string) => api(apiPaths.collaborationRole(id), { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'collaboration-roles'] }),
  });

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-h2 tracking-[-0.01em] text-ink">Collaboration roles</h2>
        <p className="mt-1 text-body-sm text-ink-2">
          What can people apply for? Roles appear in the contribute modal and project filters.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) create.mutate();
        }}
        className="flex gap-2"
      >
        <div className="flex-1">
          <Label className="sr-only">New role</Label>
          <Input
            placeholder="e.g. Hardware Engineer"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={48}
          />
        </div>
        <Button type="submit" loading={create.isPending} disabled={!name.trim()}>
          <Plus className="h-3.5 w-3.5" strokeWidth={2.25} />
          Add role
        </Button>
      </form>

      {list.isLoading ? (
        <Skeleton className="h-32 rounded-lg" />
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line bg-white">
          {list.data!.map((r) => (
            <li key={r.id} className="flex items-center justify-between px-5 py-3 text-[14px]">
              <span className="text-ink">{r.name}</span>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => archive.mutate(r.id)}
                loading={archive.isPending && archive.variables === r.id}
                aria-label={`Archive ${r.name}`}
                className="text-ink-3 hover:bg-brand-red-50 hover:text-brand-red"
              >
                <Trash2 className="h-4 w-4" strokeWidth={2.25} />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api/client';
import { apiPaths } from '@/lib/api/paths';
import type { FeatureFlag } from '@/lib/types';

const KEY_RE = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;

export function FeatureFlagManager() {
  const qc = useQueryClient();
  const { show } = useToast();
  const [key, setKey] = React.useState('');
  const [description, setDescription] = React.useState('');

  const list = useQuery({
    queryKey: ['admin', 'feature-flags'],
    queryFn: () => api<FeatureFlag[]>(apiPaths.adminFeatureFlags()),
  });

  const upsert = useMutation({
    mutationFn: (vars: { key: string; enabled: boolean; description?: string }) =>
      api(apiPaths.adminFeatureFlag(vars.key), {
        method: 'PUT',
        body: { key: vars.key, enabled: vars.enabled, description: vars.description },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'feature-flags'] });
      qc.invalidateQueries({ queryKey: ['feature-flags'] });
    },
    onError: (e: unknown) =>
      show({ tone: 'danger', title: e instanceof Error ? e.message : 'Update failed' }),
  });

  const remove = useMutation({
    mutationFn: (k: string) => api(apiPaths.adminFeatureFlag(k), { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'feature-flags'] });
      qc.invalidateQueries({ queryKey: ['feature-flags'] });
    },
  });

  function addFlag(e: React.FormEvent) {
    e.preventDefault();
    const k = key.trim();
    if (!KEY_RE.test(k)) {
      show({ tone: 'danger', title: 'Key must be lowercase dotted/snake (e.g. ui.beta_panel)' });
      return;
    }
    upsert.mutate(
      { key: k, enabled: false, description: description.trim() || undefined },
      {
        onSuccess: () => {
          setKey('');
          setDescription('');
          show({ tone: 'success', title: `Flag ${k} created (off)` });
        },
      },
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-h2 tracking-[-0.01em] text-ink">Feature flags</h2>
        <p className="mt-1 text-body-sm text-ink-2">
          Runtime kill switches. Changes take effect within ~30s, no redeploy. Unknown keys are off.
        </p>
      </div>

      <form onSubmit={addFlag} className="flex flex-col gap-2 sm:flex-row">
        <div className="flex-1">
          <Label className="sr-only">Flag key</Label>
          <Input
            placeholder="ui.beta_panel"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            maxLength={120}
          />
        </div>
        <div className="flex-1">
          <Label className="sr-only">Description</Label>
          <Input
            placeholder="What does this gate? (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={280}
          />
        </div>
        <Button type="submit" loading={upsert.isPending} disabled={!key.trim()}>
          <Plus className="h-3.5 w-3.5" strokeWidth={2.25} />
          Add flag
        </Button>
      </form>

      {list.isLoading ? (
        <Skeleton className="h-32 rounded-lg" />
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line bg-white">
          {list.data!.length === 0 && (
            <li className="p-4 text-body-sm text-ink-2">No flags yet.</li>
          )}
          {list.data!.map((f) => (
            <li key={f.key} className="flex items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <code className="text-body-sm font-medium text-ink">{f.key}</code>
                {f.description && (
                  <p className="truncate text-body-sm text-ink-2">{f.description}</p>
                )}
              </div>
              <Switch
                checked={f.enabled}
                disabled={upsert.isPending}
                onCheckedChange={(checked) =>
                  upsert.mutate({
                    key: f.key,
                    enabled: checked,
                    description: f.description ?? undefined,
                  })
                }
                aria-label={`Toggle ${f.key}`}
              />
              <button
                type="button"
                onClick={() => remove.mutate(f.key)}
                className="text-ink-2 transition-colors hover:text-brand-red"
                aria-label={`Delete ${f.key}`}
              >
                <Trash2 className="h-4 w-4" strokeWidth={2.25} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

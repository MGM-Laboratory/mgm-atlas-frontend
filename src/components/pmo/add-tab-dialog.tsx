'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { apiPaths } from '@/lib/api/paths';
import { queryKeys } from '@/lib/api/queries';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { LucideIcon, type LucideIconKey } from './lucide-icon';
import type { TaskList } from '@/lib/types';

interface Preset {
  key: string;
  label: string;
  icon: LucideIconKey;
  placeholder: string;
}

const PRESETS: Preset[] = [
  { key: 'figma', label: 'Figma', icon: 'pencil-ruler', placeholder: 'https://www.figma.com/file/…' },
  { key: 'canva', label: 'Canva', icon: 'palette', placeholder: 'https://www.canva.com/design/…' },
  { key: 'gdocs', label: 'Google Docs', icon: 'notebook', placeholder: 'https://docs.google.com/document/…' },
  { key: 'gsheets', label: 'Google Sheets', icon: 'chart-bar', placeholder: 'https://docs.google.com/spreadsheets/…' },
  { key: 'gslides', label: 'Google Slides', icon: 'layers', placeholder: 'https://docs.google.com/presentation/…' },
  { key: 'loom', label: 'Loom', icon: 'headphones', placeholder: 'https://www.loom.com/share/…' },
  { key: 'youtube', label: 'YouTube', icon: 'monitor', placeholder: 'https://www.youtube.com/embed/…' },
  { key: 'miro', label: 'Miro', icon: 'kanban-square', placeholder: 'https://miro.com/app/board/…' },
  { key: 'custom', label: 'Custom URL', icon: 'globe', placeholder: 'https://…' },
];

const isPresetLabel = (s: string) => PRESETS.some((p) => p.label === s);

export function AddTabDialog({
  projectSlug,
  listId,
  open,
  onOpenChange,
}: {
  projectSlug: string;
  listId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { show } = useToast();
  const [presetKey, setPresetKey] = React.useState('figma');
  const [label, setLabel] = React.useState('Figma');
  const [url, setUrl] = React.useState('');

  React.useEffect(() => {
    if (open) {
      setPresetKey('figma');
      setLabel('Figma');
      setUrl('');
    }
  }, [open]);

  const preset = PRESETS.find((p) => p.key === presetKey) ?? PRESETS[0];

  const choosePreset = (p: Preset) => {
    setPresetKey(p.key);
    // Prefill the name from the preset unless the user typed a custom one.
    setLabel((cur) => (cur.trim() === '' || isPresetLabel(cur) ? (p.key === 'custom' ? '' : p.label) : cur));
  };

  const valid = label.trim().length > 0 && /^https:\/\/.+/i.test(url.trim());

  const create = useMutation({
    mutationFn: () =>
      api<TaskList>(apiPaths.pmo.lists.createTab(projectSlug, listId), {
        method: 'POST',
        body: { label: label.trim(), url: url.trim(), embedPreset: presetKey, iconName: preset.icon },
      }),
    onSuccess: (list) => {
      queryClient.setQueryData(queryKeys.pmo.list(projectSlug, listId), list);
      queryClient.invalidateQueries({ queryKey: queryKeys.pmo.lists(projectSlug) });
      const created = list.tabs.find((t) => t.kind === 'EMBED' && t.label === label.trim());
      onOpenChange(false);
      if (created) router.push(`/projects/${projectSlug}/lists/${listId}/tabs/${created.id}`);
    },
    onError: (err) =>
      show({ tone: 'danger', title: 'Could not add tab', description: (err as Error).message }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <div className="space-y-1">
          <DialogTitle>Add a tab</DialogTitle>
          <DialogDescription>
            Embed an external tool or page in this list. The site must be served over https and
            allow embedding.
          </DialogDescription>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) create.mutate();
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-3 gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => choosePreset(p)}
                className={cn(
                  'flex flex-col items-center gap-1.5 rounded-lg border px-2 py-3 text-[12px]',
                  presetKey === p.key
                    ? 'border-brand-blue bg-brand-blue/5 text-brand-blue'
                    : 'border-line text-ink-2 hover:bg-surface-muted',
                )}
              >
                <LucideIcon name={p.icon} className="h-5 w-5" />
                {p.label}
              </button>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tab-label">Tab name</Label>
            <Input
              id="tab-label"
              value={label}
              maxLength={80}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Figma — wireframes"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tab-url">URL</Label>
            <Input
              id="tab-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={preset.placeholder}
              invalid={url.length > 0 && !valid}
            />
            <p className="text-[12px] text-ink-3">
              Must start with <code>https://</code>. Sites that block framing will show an “open in
              new tab” fallback.
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={create.isPending} disabled={!valid}>
              Add tab
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

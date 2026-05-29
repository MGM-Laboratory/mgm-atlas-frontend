'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Reorder, useDragControls } from 'framer-motion';
import { GripVertical, Plus, X } from 'lucide-react';
import { api } from '@/lib/api/client';
import { apiPaths } from '@/lib/api/paths';
import { queryKeys } from '@/lib/api/queries';
import {
  IMPLEMENTED_TAB_KINDS,
  TASK_LIST_TAB_LABEL,
  TASK_LIST_TAB_PATH,
  type TaskList,
  type TaskListTab,
} from '@/lib/types';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/components/ui/toast';
import { LucideIcon } from './lucide-icon';
import { AddTabDialog } from './add-tab-dialog';

export function ListNavbar({
  projectSlug,
  list,
  canManage,
}: {
  projectSlug: string;
  list: TaskList;
  canManage: boolean;
}) {
  const [tabs, setTabs] = React.useState<TaskListTab[]>(() =>
    [...list.tabs].sort((a, b) => a.order - b.order),
  );
  // Keep local order in sync when the server resends.
  React.useEffect(() => {
    setTabs([...list.tabs].sort((a, b) => a.order - b.order));
  }, [list.tabs]);

  const visibleTabs = tabs.filter((t) => !t.hidden);
  const [addOpen, setAddOpen] = React.useState(false);

  return (
    <div className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-container-wide items-center gap-1 overflow-x-auto px-6">
        {canManage ? (
          <ReorderableTabs
            projectSlug={projectSlug}
            list={list}
            tabs={tabs}
            visibleTabs={visibleTabs}
            onChange={setTabs}
          />
        ) : (
          <ul className="flex items-center">
            {visibleTabs.map((tab) => (
              <li key={tab.id} className="flex items-center">
                <TabLink projectSlug={projectSlug} listId={list.id} tab={tab} />
              </li>
            ))}
          </ul>
        )}
        {canManage ? (
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="ml-1 inline-grid h-8 w-8 shrink-0 place-items-center rounded text-ink-3 hover:bg-surface-muted hover:text-ink"
            aria-label="Add tab"
            title="Add tab"
          >
            <Plus className="h-4 w-4" strokeWidth={2.25} />
          </button>
        ) : null}
      </div>
      {canManage ? (
        <AddTabDialog
          projectSlug={projectSlug}
          listId={list.id}
          open={addOpen}
          onOpenChange={setAddOpen}
        />
      ) : null}
    </div>
  );
}

function ReorderableTabs({
  projectSlug,
  list,
  tabs,
  visibleTabs,
  onChange,
}: {
  projectSlug: string;
  list: TaskList;
  tabs: TaskListTab[];
  visibleTabs: TaskListTab[];
  onChange: (tabs: TaskListTab[]) => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const latestRef = React.useRef(tabs);
  latestRef.current = tabs;

  const reorderMutation = useMutation({
    mutationFn: async (next: TaskListTab[]) => {
      return api(apiPaths.pmo.lists.reorderTabs(projectSlug, list.id), {
        method: 'PATCH',
        body: {
          tabs: next.map((t) => ({ id: t.id, hidden: t.hidden })),
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pmo.lists(projectSlug) });
      queryClient.invalidateQueries({ queryKey: queryKeys.pmo.list(projectSlug, list.id) });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : 'Could not reorder tabs';
      toast.show({ title: 'Reorder failed', description: message, tone: 'danger' });
    },
  });

  const handleReorder = (next: TaskListTab[]) => {
    // Reorder.Group hands us only the visible items; merge hidden tabs
    // back in (at the end) so the server doesn't see them as removed.
    const hidden = tabs.filter((t) => t.hidden);
    onChange([...next, ...hidden]);
  };

  return (
    <Reorder.Group
      axis="x"
      values={visibleTabs}
      onReorder={handleReorder}
      className="flex items-center"
    >
      {visibleTabs.map((tab) => (
        <ReorderableTab
          key={tab.id}
          tab={tab}
          projectSlug={projectSlug}
          listId={list.id}
          onCommit={() => reorderMutation.mutate(latestRef.current)}
        />
      ))}
    </Reorder.Group>
  );
}

function ReorderableTab({
  tab,
  projectSlug,
  listId,
  onCommit,
}: {
  tab: TaskListTab;
  projectSlug: string;
  listId: string;
  onCommit: () => void;
}) {
  const dragControls = useDragControls();
  const queryClient = useQueryClient();
  const toast = useToast();
  const del = useMutation({
    mutationFn: () =>
      api(apiPaths.pmo.lists.deleteTab(projectSlug, listId, tab.id), { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pmo.lists(projectSlug) });
      queryClient.invalidateQueries({ queryKey: queryKeys.pmo.list(projectSlug, listId) });
    },
    onError: (err: unknown) =>
      toast.show({
        title: 'Could not remove tab',
        description: err instanceof Error ? err.message : 'Error',
        tone: 'danger',
      }),
  });
  return (
    <Reorder.Item
      value={tab}
      dragListener={false}
      dragControls={dragControls}
      onDragEnd={onCommit}
      className="group/tab relative flex items-center"
    >
      <button
        type="button"
        onPointerDown={(e) => dragControls.start(e)}
        className={cn(
          'absolute -left-1 top-1/2 -translate-y-1/2 inline-grid h-6 w-4 cursor-grab place-items-center rounded',
          'text-ink-4 opacity-0 transition-opacity duration-120 ease-out-soft',
          'group-hover/tab:opacity-100',
        )}
        aria-label="Drag to reorder tab"
        title="Drag to reorder"
      >
        <GripVertical className="h-3.5 w-3.5" strokeWidth={2.25} />
      </button>
      <TabLink projectSlug={projectSlug} listId={listId} tab={tab} />
      {tab.kind === 'EMBED' ? (
        <button
          type="button"
          onClick={() => {
            if (window.confirm(`Remove the “${tab.label}” tab?`)) del.mutate();
          }}
          className={cn(
            'absolute -right-1 top-1/2 -translate-y-1/2 inline-grid h-5 w-5 place-items-center rounded',
            'text-ink-4 opacity-0 transition-opacity duration-120 ease-out-soft',
            'hover:bg-surface-muted hover:text-brand-red group-hover/tab:opacity-100',
          )}
          aria-label="Remove tab"
          title="Remove tab"
        >
          <X className="h-3.5 w-3.5" strokeWidth={2.25} />
        </button>
      ) : null}
    </Reorder.Item>
  );
}

function TabLink({
  projectSlug,
  listId,
  tab,
}: {
  projectSlug: string;
  listId: string;
  tab: TaskListTab;
}) {
  const pathname = usePathname() ?? '';
  const base = `/projects/${projectSlug}/lists/${listId}`;
  const enabled = tab.kind === 'EMBED' ? true : IMPLEMENTED_TAB_KINDS.has(tab.kind);
  const segment = tab.kind === 'EMBED' ? `/tabs/${tab.id}` : TASK_LIST_TAB_PATH[tab.kind];
  const href = `${base}${segment}`;
  const active =
    tab.kind === 'OVERVIEW'
      ? pathname === base || pathname === `${base}/`
      : pathname.startsWith(href);

  const label = tab.label ?? TASK_LIST_TAB_LABEL[tab.kind];

  const inner = (
    <span
      className={cn(
        'flex items-center gap-2 px-4 py-3 text-[14px] font-medium',
        'border-b-2 transition-colors duration-120 ease-out-soft',
        active && enabled
          ? 'border-brand-blue text-brand-blue'
          : 'border-transparent text-ink-2 hover:text-ink',
        !enabled && 'cursor-not-allowed text-ink-4',
      )}
    >
      {tab.iconName ? <LucideIcon name={tab.iconName} className="h-4 w-4" /> : null}
      <span>{label}</span>
    </span>
  );

  if (!enabled) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span aria-disabled className="inline-block">
            {inner}
          </span>
        </TooltipTrigger>
        <TooltipContent>Coming in a later phase</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Link href={href as never} className="inline-block">
      {inner}
    </Link>
  );
}

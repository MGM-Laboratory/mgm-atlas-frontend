'use client';

import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { ApiError } from '@/lib/api/error';
import { apiPaths } from '@/lib/api/paths';
import { useToast } from '@/components/ui/toast';

/// Anything inside one of these tags or an explicit contentEditable
/// host gets its OWN Cmd+Z. Excalidraw uses a <canvas> inside a div
/// with class `excalidraw`; we sniff both possibilities (it can also
/// be rendered as a popover) by walking ancestors.
const EDITOR_TAG_RE = /^(INPUT|TEXTAREA|SELECT)$/;

function isEditingContext(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (EDITOR_TAG_RE.test(target.tagName)) return true;
  if (target.isContentEditable) return true;
  // BlockNote/Tiptap wrap their editor in a contenteditable=true; that's
  // covered by isContentEditable above. Excalidraw owns its own keydown
  // listener on a focused canvas — walk up to detect.
  let el: HTMLElement | null = target;
  while (el) {
    if (el.classList?.contains('excalidraw')) return true;
    if (el.classList?.contains('ProseMirror')) return true; // Tiptap surface
    if (el.classList?.contains('bn-container')) return true; // BlockNote root
    el = el.parentElement;
  }
  return false;
}

interface UndoResponse {
  kind: string;
  scope: string;
  taskId: string | null;
}

/**
 * Document-level Cmd/Ctrl+Z handler that calls /pmo/undo. Skipped when
 * focus is inside a text input or any of the WYSIWYG editor surfaces
 * (BlockNote, Tiptap, Excalidraw) so their native undo wins.
 *
 * On success: invalidates all PMO task queries (kanban / list / modal)
 * so the UI reflects the reversal, and shows a green toast naming the
 * op. On 409: shows a red toast — the entry stays available so the
 * user can try again.
 */
export function GlobalUndoListener() {
  const { show } = useToast();
  const queryClient = useQueryClient();
  const inFlight = React.useRef(false);

  React.useEffect(() => {
    const onKeyDown = async (e: KeyboardEvent) => {
      const ctrlOrCmd = e.metaKey || e.ctrlKey;
      if (!ctrlOrCmd) return;
      if (e.key !== 'z' && e.key !== 'Z' && e.key !== 'y' && e.key !== 'Y') return;
      if (isEditingContext(e.target)) return;
      if (inFlight.current) return;

      // Ctrl+Y is the Windows convention for redo; Cmd+Shift+Z is Mac;
      // we accept both.
      const isRedo =
        (e.key === 'Y' || e.key === 'y') || ((e.key === 'Z' || e.key === 'z') && e.shiftKey);

      e.preventDefault();
      e.stopPropagation();
      inFlight.current = true;

      const verb = isRedo ? 'Redid' : 'Undid';
      try {
        const result = await api<UndoResponse>(
          isRedo ? apiPaths.pmo.redo() : apiPaths.pmo.undo(),
          { method: 'POST' },
        );
        await queryClient.invalidateQueries({ queryKey: ['pmo'] });
        show({
          tone: 'success',
          title: `${verb} ${humanKind(result.kind)}`,
        });
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          show({
            tone: 'info',
            title: isRedo ? 'Nothing to redo' : 'Nothing to undo',
          });
        } else {
          show({
            tone: 'danger',
            title: isRedo ? 'Couldn’t redo' : 'Couldn’t undo',
            description: err instanceof Error ? err.message : 'List state has changed',
          });
        }
      } finally {
        inFlight.current = false;
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [queryClient, show]);

  return null;
}

function humanKind(kind: string): string {
  switch (kind) {
    case 'TASK_MOVED':
      return 'task move';
    case 'TASK_UPDATED':
      return 'task edit';
    default:
      return kind.toLowerCase().replace(/_/g, ' ');
  }
}

import * as Y from 'yjs';
import type { WebsocketProvider } from 'y-websocket';

/**
 * Minimal structural view of the bits of Excalidraw we touch, so the binding
 * doesn't depend on Excalidraw's (version-volatile) exported type paths.
 */
export interface ExElement {
  id: string;
  version: number;
  index?: string | null;
  isDeleted?: boolean;
  [key: string]: unknown;
}

interface CollaboratorPointer {
  x: number;
  y: number;
}

export interface ExcalidrawApiLike {
  updateScene(scene: {
    elements?: readonly ExElement[];
    collaborators?: Map<string, unknown>;
  }): void;
  getSceneElementsIncludingDeleted(): readonly ExElement[];
  getAppState(): Record<string, unknown>;
  getFiles(): Record<string, unknown>;
}

export interface BindingUser {
  /// Session user id — carried in awareness so the y-websocket sidecar
  /// can attribute the next snapshot revision to a real User row (PR2).
  id: string;
  name: string;
  color: string;
}

function sortByIndex(a: ExElement, b: ExElement): number {
  const ai = a.index ?? '';
  const bi = b.index ?? '';
  if (ai < bi) return -1;
  if (ai > bi) return 1;
  return 0;
}

/**
 * Two-way sync between an Excalidraw scene and a Yjs document.
 *
 * Elements live in a Y.Map keyed by element id; Excalidraw's per-element
 * `version` is the merge arbiter (higher wins) and `index` (fractional)
 * gives stable z-order across clients. Local writes use this binding as the
 * transaction origin so the observer ignores its own echoes; remote applies
 * are additionally version-guarded so an updateScene-triggered onChange never
 * loops back. Awareness carries live pointer + name/color for collaborators.
 */
export class ExcalidrawYjsBinding {
  private readonly yElements: Y.Map<ExElement>;
  private applyingRemote = false;
  private readonly onYChange: (event: Y.YMapEvent<ExElement>, txn: Y.Transaction) => void;
  private readonly onAwareness: () => void;

  constructor(
    private readonly doc: Y.Doc,
    private readonly provider: WebsocketProvider,
    private readonly api: ExcalidrawApiLike,
    private readonly user: BindingUser,
  ) {
    this.yElements = doc.getMap<ExElement>('elements');

    this.onYChange = (_event, txn) => {
      if (txn.origin === this) return;
      this.applyRemoteToScene();
    };
    this.yElements.observe(this.onYChange);

    this.onAwareness = () => this.renderCollaborators();
    this.provider.awareness.setLocalStateField('user', this.user);
    this.provider.awareness.on('change', this.onAwareness);

    // Seed from whatever is already in the doc (usually empty until the
    // provider finishes syncing the stored snapshot, which fires onYChange).
    this.applyRemoteToScene();
  }

  /** Feed Excalidraw's onChange here (pass elements *including* deleted). */
  pushLocal(elements: readonly ExElement[]): void {
    if (this.applyingRemote) return;
    this.doc.transact(() => {
      for (const el of elements) {
        const existing = this.yElements.get(el.id);
        if (!existing || (existing.version ?? 0) < (el.version ?? 0)) {
          this.yElements.set(el.id, el);
        }
      }
    }, this);
  }

  /** Replace the whole document (used by `.mgm` import — overwrites for everyone). */
  replaceAll(elements: readonly ExElement[]): void {
    this.doc.transact(() => {
      this.yElements.clear();
      for (const el of elements) this.yElements.set(el.id, el);
    }, this);
    // origin === this means the observer skipped, so reflect locally by hand.
    this.applyRemoteToScene();
  }

  /** Feed Excalidraw's onPointerUpdate here. */
  pushPointer(pointer: CollaboratorPointer, button: string): void {
    this.provider.awareness.setLocalStateField('pointer', pointer);
    this.provider.awareness.setLocalStateField('button', button);
  }

  private applyRemoteToScene(): void {
    const elements = [...this.yElements.values()].sort(sortByIndex);
    this.applyingRemote = true;
    try {
      this.api.updateScene({ elements });
    } finally {
      this.applyingRemote = false;
    }
  }

  private renderCollaborators(): void {
    const states = this.provider.awareness.getStates();
    const localId = this.provider.awareness.clientID;
    const collaborators = new Map<string, unknown>();
    states.forEach((state, clientId) => {
      if (clientId === localId) return;
      const u = (state.user ?? {}) as Partial<BindingUser>;
      collaborators.set(String(clientId), {
        username: u.name ?? 'Guest',
        color: { background: u.color ?? '#888', stroke: u.color ?? '#888' },
        pointer: state.pointer,
        button: state.button,
      });
    });
    this.api.updateScene({ collaborators });
  }

  destroy(): void {
    this.yElements.unobserve(this.onYChange);
    this.provider.awareness.off('change', this.onAwareness);
  }
}

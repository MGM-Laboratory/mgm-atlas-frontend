'use client';

import { Loader2, Maximize2, Minimize2, Volume2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useVoice } from '@/lib/voice/voice-provider';
import { ParticipantTile } from './participant-tile';
import { StageRoom } from './stage-room';
import { VoiceControls } from './voice-controls';

/**
 * Main voice-room view. Auto-joins on mount when the user is idle.
 * Refuses to auto-disconnect a different active call (the sidebar
 * dialog or the in-room "Switch to X" button handles that).
 *
 * Phase 2 adds:
 *   - Spotlight layout (one big tile + filmstrip) when someone is
 *     sharing screen OR the user has explicitly pinned a participant
 *   - Fullscreen toggle on the spotlight pane
 *   - The bottom VoiceControls bar (mic / cam / screen / deafen / leave)
 */
export function VoiceRoom({
  channelId,
  channelName,
  projectId,
  projectSlugOrId,
  canModerate,
}: {
  channelId: string;
  channelName: string;
  projectId: string | null;
  /** Project slug for the moderation move submenu. null for lobby. */
  projectSlugOrId?: string | null;
  /** Phase 5: when true, participant tiles show the moderator-only menu items. */
  canModerate?: boolean;
}) {
  const { state, actions } = useVoice();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Auto-join on mount unless we're already in a different channel.
  useEffect(() => {
    if (state.channelId === channelId && state.connectionState !== 'idle') return;
    if (state.channelId !== null && state.channelId !== channelId) return;
    void actions.joinChannel(channelId, { projectId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId, projectId]);

  // Keep isFullscreen state in sync with the browser's fullscreenchange.
  useEffect(() => {
    const handler = () => {
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    };
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await containerRef.current.requestFullscreen();
    }
  };

  if (state.connectionState === 'connecting' && state.channelId === channelId) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-ink-2">
        <Loader2 className="h-8 w-8 animate-spin text-brand-blue" strokeWidth={2.25} />
        <div className="text-sm">Connecting to {channelName}…</div>
      </div>
    );
  }

  if (state.connectionState === 'error' && state.channelId === channelId) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-ink-2">
        <div className="text-sm text-brand-red">
          Couldn&apos;t connect{state.error ? `: ${state.error}` : '.'}
        </div>
        <Button onClick={() => void actions.joinChannel(channelId, { projectId })}>
          Try again
        </Button>
      </div>
    );
  }

  // The user is already in a different channel — gate the switch
  // behind an explicit click.
  if (state.channelId && state.channelId !== channelId) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-ink-2">
        <div className="text-sm">
          You&apos;re already in <strong>{state.channelName ?? 'another channel'}</strong>.
        </div>
        <Button onClick={() => void actions.joinChannel(channelId, { projectId })}>
          Switch to {channelName}
        </Button>
      </div>
    );
  }

  // Phase 8 — stage channels get their own layout (speakers + audience).
  if (state.channelKind === 'STAGE' && state.channelId === channelId) {
    return (
      <StageRoom
        channelId={channelId}
        channelName={channelName}
        projectId={projectId}
        projectSlugOrId={projectSlugOrId ?? null}
        canModerate={!!canModerate}
      />
    );
  }

  const participants = Array.from(state.participants.values());
  const spotlight =
    (state.spotlightIdentity && state.participants.get(state.spotlightIdentity)) ||
    participants.find((p) => p.isScreenSharing) ||
    null;

  // Empty state.
  if (participants.length === 0) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-ink-2">
          <Volume2 className="h-8 w-8 text-ink-3" strokeWidth={2.25} />
          <div className="text-sm">You&apos;re the only one here.</div>
          <div className="max-w-xs text-center text-xs text-ink-3">
            Share this voice channel with a teammate to start talking.
          </div>
        </div>
        <VoiceControls channelId={channelId} canModerate={canModerate} />
      </div>
    );
  }

  const others = participants.filter((p) => p.identity !== spotlight?.identity);

  // Spotlight layout: one big tile + filmstrip on the right (or below
  // on narrow viewports). Spotlight kicks in when someone is sharing
  // screen, the user has pinned a tile, OR there are 1–2 people total.
  if (spotlight) {
    return (
      <div ref={containerRef} className="flex h-full flex-col bg-surface-1">
        <div className="relative flex min-h-0 flex-1 flex-col gap-3 p-3 md:flex-row">
          <div className="relative min-h-[60vh] flex-1 md:min-h-0">
            <ParticipantTile
              participant={spotlight}
              large
              canModerate={canModerate}
              projectSlugOrId={projectSlugOrId ?? null}
              currentChannelId={channelId}
            />
            <button
              type="button"
              onClick={() => void toggleFullscreen()}
              className="absolute right-2 top-2 inline-grid h-8 w-8 place-items-center rounded-md bg-black/40 text-white opacity-0 transition-opacity hover:bg-black/60 group-hover:opacity-100 focus-visible:opacity-100"
              aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            >
              {isFullscreen ? (
                <Minimize2 className="h-4 w-4" strokeWidth={2.25} />
              ) : (
                <Maximize2 className="h-4 w-4" strokeWidth={2.25} />
              )}
            </button>
          </div>
          {others.length > 0 ? (
            <div className="flex shrink-0 flex-row gap-2 overflow-x-auto md:max-h-full md:w-48 md:flex-col md:overflow-y-auto">
              {others.map((p) => (
                <div key={p.identity} className="w-32 shrink-0 md:w-full">
                  <ParticipantTile
                    participant={p}
                    onClick={() => actions.setSpotlight(p.identity)}
                    canModerate={canModerate}
                    projectSlugOrId={projectSlugOrId ?? null}
                    currentChannelId={channelId}
                  />
                </div>
              ))}
            </div>
          ) : null}
        </div>
        <VoiceControls channelId={channelId} canModerate={canModerate} />
      </div>
    );
  }

  // Equal grid (no spotlight): adapts to participant count.
  const colClass =
    participants.length <= 2
      ? 'grid-cols-1 sm:grid-cols-2'
      : participants.length <= 4
        ? 'grid-cols-2'
        : participants.length <= 9
          ? 'grid-cols-2 sm:grid-cols-3'
          : 'grid-cols-3 sm:grid-cols-4';

  return (
    <div className="flex h-full flex-col">
      <div className={`grid min-h-0 flex-1 gap-3 overflow-auto p-3 ${colClass}`}>
        {participants.map((p) => (
          <ParticipantTile
            key={p.identity}
            participant={p}
            onClick={() => actions.setSpotlight(p.identity)}
            canModerate={canModerate}
            projectSlugOrId={projectSlugOrId ?? null}
            currentChannelId={channelId}
          />
        ))}
      </div>
      <VoiceControls channelId={channelId} canModerate={canModerate} />
    </div>
  );
}

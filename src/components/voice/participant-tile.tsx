'use client';

import { MicOff, MonitorUp, VolumeX } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useVoice, type VoiceParticipantView } from '@/lib/voice/voice-provider';
import { ParticipantMenu } from './participant-menu';

interface Props {
  participant: VoiceParticipantView;
  /** When true, the tile fills its container (used in the spotlight pane). */
  large?: boolean;
  /** Click handler — typically toggles spotlight to this participant. */
  onClick?: () => void;
  /** Right-click context menu wiring (Phase 5). When omitted, no menu. */
  canModerate?: boolean;
  projectSlugOrId?: string | null;
  currentChannelId?: string;
}

/**
 * Renders one participant. Visual order of preference:
 *   1. Screen-share video, if they're sharing AND this is the large tile
 *      (the small tile keeps the camera/avatar so the row shows who they are)
 *   2. Camera video, if their camera is on
 *   3. Avatar fallback with speaking halo
 *
 * Mic mute / screen-share badges sit over the lower-right corner.
 */
export function ParticipantTile({
  participant,
  large,
  onClick,
  canModerate,
  projectSlugOrId,
  currentChannelId,
}: Props) {
  const {
    name,
    avatarUrl,
    isMuted,
    isSpeaking,
    audioLevel,
    isLocal,
    cameraTrack,
    screenShareTrack,
    isScreenSharing,
    screenShareAudioTrack,
  } = participant;

  const { state } = useVoice();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const screenAudioRef = useRef<HTMLAudioElement | null>(null);

  // Phase 5: right-click opens the per-participant menu (anchored at
  // the click coords). Long-press touch is a Phase 7 polish.
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number } | null>(null);
  const isLocallyMuted = state.localMuted.has(participant.identity);

  // Which video track this tile should show. Big tile prefers screen-share;
  // small tile prefers camera (so the row stays "who" not "what they show").
  const showTrack = large && screenShareTrack ? screenShareTrack : cameraTrack;
  const hasVideo = !!showTrack;

  // Attach video track.
  useEffect(() => {
    if (!showTrack || !videoRef.current) return;
    showTrack.attach(videoRef.current);
    return () => {
      showTrack.detach();
    };
  }, [showTrack]);

  // Attach screen-share audio (Chromium "Share tab audio") to a hidden
  // <audio> element when the BIG tile is showing this person sharing.
  // Skip when local (don't echo our own captured audio) or deafened.
  useEffect(() => {
    if (!screenShareAudioTrack || !screenAudioRef.current || isLocal || state.deafened) return;
    screenShareAudioTrack.attach(screenAudioRef.current);
    return () => {
      screenShareAudioTrack.detach();
    };
  }, [screenShareAudioTrack, isLocal, state.deafened]);

  const halo = !isMuted && isSpeaking && !hasVideo
    ? Math.min(audioLevel * 24 + 4, 28)
    : 0;

  return (
    <button
      type="button"
      onClick={onClick}
      onContextMenu={(e) => {
        // Tile menu — even non-mods see volume + local-mute + profile.
        if (isLocal) return; // skip menu on self
        e.preventDefault();
        setMenuAnchor({ x: e.clientX, y: e.clientY });
        setMenuOpen(true);
      }}
      className={cn(
        'group/tile relative flex flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border border-line-2 bg-surface-1 transition-shadow duration-200 ease-out-soft',
        large ? 'h-full w-full' : 'aspect-video p-3',
        onClick ? 'cursor-pointer' : '',
        isSpeaking && !isMuted && !hasVideo ? 'ring-2 ring-brand-green' : '',
      )}
      style={
        halo > 0
          ? { boxShadow: `0 0 0 ${halo}px rgba(56, 161, 105, 0.25)` }
          : undefined
      }
    >
      {hasVideo ? (
        <video
          ref={videoRef}
          autoPlay
          muted={isLocal}
          playsInline
          className={cn(
            'absolute inset-0 h-full w-full object-cover',
            // Local camera mirrors so it feels like a mirror image.
            isLocal && cameraTrack && showTrack === cameraTrack ? 'scale-x-[-1]' : '',
          )}
        />
      ) : (
        <Avatar
          src={avatarUrl}
          name={name}
          size={large ? 64 : 48}
          className={cn(
            'ring-2 transition-colors duration-200 ease-out-soft',
            isSpeaking && !isMuted ? 'ring-brand-green' : 'ring-line-2',
          )}
        />
      )}

      <audio ref={screenAudioRef} autoPlay style={{ display: 'none' }} />

      {/* Footer with name + status badges */}
      <div
        className={cn(
          'absolute bottom-2 left-2 right-2 flex items-center justify-between gap-2',
          hasVideo
            ? 'rounded-md bg-black/50 px-2 py-1 text-xs font-medium text-white'
            : 'mt-2 text-sm font-medium text-ink-1 static px-0',
        )}
      >
        <span className="truncate">
          {name}
          {isLocal ? <span className="ml-1 opacity-70 text-xs">(you)</span> : null}
        </span>
        <div className="flex shrink-0 items-center gap-1">
          {isScreenSharing ? (
            <span title="Sharing screen">
              <MonitorUp className="h-3 w-3" strokeWidth={2.5} />
            </span>
          ) : null}
          {isMuted ? (
            <span
              className={cn(
                'inline-flex h-4 w-4 items-center justify-center rounded-full',
                hasVideo ? 'bg-brand-red' : 'bg-brand-red text-white',
              )}
              title="Muted"
            >
              <MicOff className="h-2.5 w-2.5 text-white" strokeWidth={2.5} />
            </span>
          ) : null}
          {isLocallyMuted ? (
            <span
              className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-ink-2 text-white"
              title="Muted only for you"
            >
              <VolumeX className="h-2.5 w-2.5" strokeWidth={2.5} />
            </span>
          ) : null}
        </div>
      </div>
      {!isLocal ? (
        <ParticipantMenu
          participant={participant}
          open={menuOpen}
          onOpenChange={setMenuOpen}
          anchor={menuAnchor}
          canModerate={!!canModerate}
          projectSlugOrId={projectSlugOrId ?? null}
          currentChannelId={currentChannelId ?? ''}
        />
      ) : null}
    </button>
  );
}

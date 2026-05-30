'use client';

import { MicOff } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import type { VoiceParticipantView } from '@/lib/voice/voice-provider';

/**
 * A single tile in the voice room grid. The speaking halo is a CSS
 * box-shadow whose strength scales with the participant's audio level
 * (0..1 from LiveKit). Muted users never show the halo; instead a
 * MicOff badge sits over the avatar.
 *
 * Phase 2 will extend this to render video when the participant has a
 * camera track published; for now it's avatar-only audio.
 */
export function ParticipantTile({ participant }: { participant: VoiceParticipantView }) {
  const { name, avatarUrl, isMuted, isSpeaking, audioLevel, isLocal } = participant;
  const halo = !isMuted && isSpeaking ? Math.min(audioLevel * 24 + 4, 28) : 0;

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-xl border border-line-2 bg-surface-1 p-4 transition-shadow duration-200 ease-out-soft',
      )}
      style={
        halo > 0
          ? { boxShadow: `0 0 0 ${halo}px rgba(56, 161, 105, 0.25)` }
          : undefined
      }
    >
      <div className="relative">
        <Avatar
          src={avatarUrl}
          name={name}
          size={64}
          className={cn(
            'ring-2 transition-colors duration-200 ease-out-soft',
            isSpeaking && !isMuted ? 'ring-brand-green' : 'ring-line-2',
          )}
        />
        {isMuted ? (
          <div className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full bg-brand-red text-white">
            <MicOff className="h-3 w-3" strokeWidth={2.5} />
          </div>
        ) : null}
      </div>
      <div className="max-w-full truncate text-sm font-medium text-ink-1">
        {name}
        {isLocal ? <span className="ml-1 text-ink-3 text-xs">(you)</span> : null}
      </div>
    </div>
  );
}

'use client';

import { CircleDot, Loader2, Mic, MicOff, PhoneOff, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useVoice } from '@/lib/voice/voice-provider';

/**
 * Persistent "you're in a call" panel. Mounted in (authenticated)/layout.tsx
 * so it survives any navigation within the authenticated area. Renders
 * nothing while the user is idle.
 *
 * Phase 7 polish:
 *   - Connection-quality bars (3 = excellent, 2 = good, 1 = poor)
 *     replace the generic Wifi icon.
 *   - Ping (RTT) shown next to the participant count.
 *   - A red 🔴 REC pill appears when state.recording is set.
 */
export function VoiceConnectedPanel() {
  const { state, actions } = useVoice();

  if (state.connectionState === 'idle' || state.connectionState === 'disconnected') {
    return null;
  }

  const isError = state.connectionState === 'error';
  const isConnecting =
    state.connectionState === 'connecting' || state.connectionState === 'reconnecting';

  return (
    <div className="fixed bottom-4 left-4 z-50 w-72 rounded-xl border border-line-2 bg-surface-1 shadow-2 backdrop-blur-sm">
      <div className="flex items-center gap-2 border-b border-line-2 px-3 py-2">
        {isError ? (
          <WifiOff className="h-4 w-4 text-brand-red" strokeWidth={2.25} />
        ) : isConnecting ? (
          <Loader2
            className="h-4 w-4 animate-spin text-brand-blue"
            strokeWidth={2.25}
          />
        ) : (
          <ConnectionBars quality={state.connectionQuality} />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-xs font-medium text-ink-1">
              {state.channelName ?? 'Connecting…'}
            </span>
            {state.recording ? (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-brand-red px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white"
                title={`Recording started by ${state.recording.startedByName}`}
              >
                <CircleDot className="h-2 w-2 animate-pulse" strokeWidth={3} />
                REC
              </span>
            ) : null}
          </div>
          <div className="text-[10px] uppercase tracking-wide text-ink-3">
            {state.connectionState === 'connected'
              ? `${state.participants.size} ${
                  state.participants.size === 1 ? 'person' : 'people'
                }${state.ping !== null ? ` · ${state.ping}ms` : ''}`
              : state.connectionState === 'reconnecting'
                ? 'Reconnecting…'
                : isError
                  ? 'Disconnected'
                  : 'Connecting…'}
          </div>
        </div>
      </div>
      {state.error ? (
        <div className="px-3 py-1.5 text-[11px] text-brand-red">{state.error}</div>
      ) : null}
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => void actions.toggleMute()}
              disabled={state.connectionState !== 'connected'}
              aria-label={state.micMuted ? 'Unmute microphone' : 'Mute microphone'}
            >
              {state.micMuted ? (
                <MicOff className="h-4 w-4 text-brand-red" strokeWidth={2.25} />
              ) : (
                <Mic className="h-4 w-4" strokeWidth={2.25} />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{state.micMuted ? 'Unmute' : 'Mute'}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => void actions.leaveChannel()}
              aria-label="Disconnect from voice"
            >
              <PhoneOff className="h-4 w-4 text-brand-red" strokeWidth={2.25} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Disconnect</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

/**
 * Discord-style wifi bars. quality:
 *   excellent → 3 bars green
 *   good      → 2 bars green
 *   poor      → 1 bar yellow/red
 *   unknown   → grey Wifi icon (haven't received a quality event yet)
 */
function ConnectionBars({
  quality,
}: {
  quality: 'excellent' | 'good' | 'poor' | 'unknown';
}) {
  if (quality === 'unknown') {
    return <Wifi className="h-4 w-4 text-ink-3" strokeWidth={2.25} />;
  }
  const activeBars = quality === 'excellent' ? 3 : quality === 'good' ? 2 : 1;
  const color =
    quality === 'excellent' || quality === 'good'
      ? 'bg-brand-green'
      : 'bg-brand-yellow';
  return (
    <div
      className="flex h-4 items-end gap-px"
      title={`Connection quality: ${quality}`}
    >
      {[1, 2, 3].map((i) => (
        <span
          key={i}
          className={cn(
            'w-1 rounded-sm',
            i === 1 ? 'h-2' : i === 2 ? 'h-3' : 'h-4',
            i <= activeBars ? color : 'bg-line-2',
          )}
        />
      ))}
    </div>
  );
}

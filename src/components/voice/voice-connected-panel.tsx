'use client';

import { Loader2, Mic, MicOff, PhoneOff, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useVoice } from '@/lib/voice/voice-provider';

/**
 * Persistent "you're in a call" panel. Mounted in (authenticated)/layout.tsx
 * so it survives any navigation within the authenticated area. Renders
 * nothing while the user is idle.
 *
 * Discord-equivalent: the panel above the user-card in the bottom-left
 * sidebar. Shows the channel + connection state + quick controls. The
 * full voice room view (grid of tiles) lives at its own route.
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
          <Wifi className="h-4 w-4 text-brand-green" strokeWidth={2.25} />
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-medium text-ink-1">
            {state.channelName ?? 'Connecting…'}
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

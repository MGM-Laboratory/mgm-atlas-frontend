'use client';

import * as React from 'react';
import {
  ChevronDown,
  Headphones,
  HeadphoneOff,
  Mic,
  MicOff,
  MonitorOff,
  MonitorUp,
  PhoneOff,
  Settings,
  Video,
  VideoOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { VoiceSettingsDialog } from './voice-settings-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useVoice } from '@/lib/voice/voice-provider';

/**
 * Bottom-of-room controls: mic, camera, screen-share, deafen, leave.
 * Each toggle has a chevron that opens a device picker / quality menu.
 * Disabled until the room is fully connected.
 */
export function VoiceControls() {
  const { state, actions } = useVoice();
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const connected = state.connectionState === 'connected';
  const reconnecting = state.connectionState === 'reconnecting';
  const ready = connected || reconnecting;

  return (
    <div className="flex items-center justify-center gap-1 border-t border-line-2 bg-surface-muted/40 px-4 py-3">
      {/* Mic */}
      <ButtonWithMenu
        label={state.micMuted ? 'Unmute' : 'Mute'}
        active={!state.micMuted}
        danger={state.micMuted}
        icon={state.micMuted ? <MicOff /> : <Mic />}
        onClick={() => void actions.toggleMute()}
        disabled={!ready}
        menu={
          <>
            <DropdownMenuLabel>Microphone</DropdownMenuLabel>
            {state.devices.mics.length === 0 ? (
              <DropdownMenuItem disabled>No microphones detected</DropdownMenuItem>
            ) : (
              state.devices.mics.map((d) => (
                <DropdownMenuItem
                  key={d.deviceId}
                  onSelect={() => void actions.switchMicDevice(d.deviceId)}
                  className={cn(
                    'text-[13px]',
                    state.micDeviceId === d.deviceId ? 'font-medium text-brand-blue' : '',
                  )}
                >
                  {d.label || `Microphone ${d.deviceId.slice(0, 6)}`}
                </DropdownMenuItem>
              ))
            )}
          </>
        }
      />

      {/* Camera */}
      <ButtonWithMenu
        label={state.cameraEnabled ? 'Turn camera off' : 'Turn camera on'}
        active={state.cameraEnabled}
        icon={state.cameraEnabled ? <Video /> : <VideoOff />}
        onClick={() => void actions.toggleCamera()}
        disabled={!ready}
        menu={
          <>
            <DropdownMenuLabel>Camera</DropdownMenuLabel>
            {state.devices.cameras.length === 0 ? (
              <DropdownMenuItem disabled>No cameras detected</DropdownMenuItem>
            ) : (
              state.devices.cameras.map((d) => (
                <DropdownMenuItem
                  key={d.deviceId}
                  onSelect={() => void actions.switchCameraDevice(d.deviceId)}
                  className={cn(
                    'text-[13px]',
                    state.cameraDeviceId === d.deviceId ? 'font-medium text-brand-blue' : '',
                  )}
                >
                  {d.label || `Camera ${d.deviceId.slice(0, 6)}`}
                </DropdownMenuItem>
              ))
            )}
          </>
        }
      />

      {/* Screen share */}
      <ButtonWithMenu
        label={state.screenSharing ? 'Stop sharing' : 'Share screen'}
        active={state.screenSharing}
        icon={state.screenSharing ? <MonitorOff /> : <MonitorUp />}
        onClick={() => void actions.toggleScreenShare()}
        disabled={!ready}
        menu={
          <>
            <DropdownMenuLabel>Screen share quality</DropdownMenuLabel>
            <DropdownMenuItem
              onSelect={() => void actions.toggleScreenShare('720p30', true)}
              disabled={state.screenSharing}
            >
              720p · 30fps (low bandwidth)
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => void actions.toggleScreenShare('1080p30', true)}
              disabled={state.screenSharing}
            >
              1080p · 30fps (default)
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => void actions.toggleScreenShare('1080p60', true)}
              disabled={state.screenSharing}
            >
              1080p · 60fps (high motion)
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => void actions.toggleScreenShare()}
              disabled={!state.screenSharing}
            >
              Stop sharing
            </DropdownMenuItem>
          </>
        }
      />

      {/* Deafen */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={state.deafened ? 'danger' : 'ghost'}
            size="icon"
            onClick={() => void actions.toggleDeafen()}
            disabled={!ready}
            aria-label={state.deafened ? 'Undeafen' : 'Deafen'}
          >
            {state.deafened ? (
              <HeadphoneOff className="h-4 w-4" strokeWidth={2.25} />
            ) : (
              <Headphones className="h-4 w-4" strokeWidth={2.25} />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{state.deafened ? 'Undeafen' : 'Deafen'}</TooltipContent>
      </Tooltip>

      <div className="mx-1 h-6 w-px bg-line-2" />

      {/* Settings */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSettingsOpen(true)}
            aria-label="Voice settings"
          >
            <Settings className="h-4 w-4" strokeWidth={2.25} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Voice settings</TooltipContent>
      </Tooltip>

      {/* Leave */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="danger"
            size="icon"
            onClick={() => void actions.leaveChannel()}
            disabled={state.connectionState === 'idle'}
            aria-label="Disconnect"
          >
            <PhoneOff className="h-4 w-4" strokeWidth={2.25} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Disconnect</TooltipContent>
      </Tooltip>

      <VoiceSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}

/**
 * A toggle button (left) + chevron-dropdown trigger (right) for things
 * like mic / camera / screen-share where the main action is "toggle"
 * and the secondary action is "pick a device / quality".
 */
function ButtonWithMenu({
  label,
  icon,
  active,
  danger,
  onClick,
  disabled,
  menu,
}: {
  label: string;
  icon: React.ReactNode;
  active?: boolean;
  danger?: boolean;
  onClick: () => void;
  disabled?: boolean;
  menu: React.ReactNode;
}) {
  return (
    <div className="flex items-center">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={danger ? 'danger' : active ? 'primary' : 'ghost'}
            size="icon"
            onClick={onClick}
            disabled={disabled}
            aria-label={label}
            className="rounded-r-none"
          >
            <span className="[&_svg]:h-4 [&_svg]:w-4">{icon}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant={danger ? 'danger' : active ? 'primary' : 'ghost'}
            size="icon"
            disabled={disabled}
            aria-label={`${label} settings`}
            className="rounded-l-none border-l border-l-black/10 px-1"
          >
            <ChevronDown className="h-3 w-3" strokeWidth={2.25} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="min-w-[220px]">
          {menu}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/** Tiny placeholder for the connection-quality indicator (Phase 7). */
export function VoiceConnectionBadge() {
  const { state } = useVoice();
  if (state.connectionState !== 'connected') return null;
  return (
    <div className="flex items-center gap-1 text-[11px] text-ink-3">
      <Settings className="h-3 w-3" strokeWidth={2.25} />
      Connected
    </div>
  );
}

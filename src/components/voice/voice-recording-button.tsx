'use client';

import * as React from 'react';
import { CircleDot, Download, History, Loader2, Square } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { apiPaths } from '@/lib/api/paths';
import { queryKeys } from '@/lib/api/queries';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useVoice } from '@/lib/voice/voice-provider';

interface RecordingItem {
  id: string;
  channelId: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  startedAt: string;
  endedAt: string | null;
  durationSec: number | null;
  sizeBytes: string | number | null;
  retentionUntil: string | null;
  errorMessage: string | null;
  startedBy: { id: string; name: string; avatarUrl: string | null };
}

/**
 * Mod-only Record button + Recordings popover. Mounted in
 * VoiceControls only when `canModerate` is true.
 *
 * Flow:
 *   • No recording → "Start recording" button with confirmation dialog
 *     warning everyone will be notified.
 *   • Recording active → "Stop recording" button (still admin-only —
 *     anyone can leave to dodge the recording, but the recording can
 *     only be ended by a moderator).
 *
 * Recordings popover shows the channel's recording history with
 * download links (presigned GET URLs).
 */
export function VoiceRecordingButton({ channelId }: { channelId: string }) {
  const { state, actions } = useVoice();
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const isRecording = state.recording !== null;
  const ready = state.connectionState === 'connected';

  const onClick = () => {
    if (isRecording) {
      void actions.stopRecording();
    } else {
      setConfirmOpen(true);
    }
  };

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={isRecording ? 'danger' : 'ghost'}
            size="icon"
            onClick={onClick}
            disabled={!ready}
            aria-label={isRecording ? 'Stop recording' : 'Start recording'}
          >
            {isRecording ? (
              <Square className="h-4 w-4" strokeWidth={2.5} />
            ) : (
              <CircleDot className="h-4 w-4 text-brand-red" strokeWidth={2.25} />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {isRecording ? 'Stop recording' : 'Start recording'}
        </TooltipContent>
      </Tooltip>

      <RecordingsHistoryPopover channelId={channelId} />

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogTitle>Start recording this call?</DialogTitle>
          <DialogDescription>
            A red <strong>REC</strong> badge will appear for everyone in the
            channel, and a notification will tell them the call is being
            recorded. Recordings are stored for 30 days.
          </DialogDescription>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setConfirmOpen(false);
                void actions.startRecording();
              }}
            >
              Start recording
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function RecordingsHistoryPopover({ channelId }: { channelId: string }) {
  const [open, setOpen] = React.useState(false);

  const recordingsQuery = useQuery({
    queryKey: queryKeys.voice.recordings(channelId),
    queryFn: () =>
      api<{ items: RecordingItem[] }>(apiPaths.voice.recordings(channelId)).then(
        (r) => r.items,
      ),
    enabled: open,
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Recordings history">
              <History className="h-4 w-4" strokeWidth={2.25} />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Recordings</TooltipContent>
      </Tooltip>
      <PopoverContent side="top" align="end" className="w-[340px] p-0">
        <div className="flex items-center gap-2 border-b border-line-2 px-3 py-2 text-sm font-medium text-ink-1">
          <History className="h-3.5 w-3.5" strokeWidth={2.25} />
          Recordings
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-3">
          {recordingsQuery.isLoading ? (
            <div className="flex justify-center py-6 text-ink-3">
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.25} />
            </div>
          ) : (recordingsQuery.data?.length ?? 0) === 0 ? (
            <div className="py-6 text-center text-[12px] text-ink-3">
              No recordings yet for this channel.
            </div>
          ) : (
            <ul className="space-y-1.5">
              {recordingsQuery.data!.map((rec) => (
                <RecordingRow key={rec.id} recording={rec} />
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function RecordingRow({ recording }: { recording: RecordingItem }) {
  const queryClient = useQueryClient();
  const downloadMutation = useMutation({
    mutationFn: () =>
      api<{ downloadUrl: string; expiresIn: number }>(
        apiPaths.voice.recordingDownload(recording.id),
      ),
    onSuccess: (res) => {
      window.open(res.downloadUrl, '_blank', 'noopener');
    },
    onError: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.voice.recordings(recording.channelId),
      });
    },
  });

  const startedAt = new Date(recording.startedAt);
  const duration =
    recording.durationSec !== null
      ? `${Math.floor(recording.durationSec / 60)}m ${recording.durationSec % 60}s`
      : null;
  const expired =
    recording.retentionUntil !== null &&
    new Date(recording.retentionUntil) < new Date();
  const downloadable = recording.status === 'COMPLETED' && !expired;

  return (
    <li
      className={cn(
        'rounded-md border border-line-2 bg-surface-1 px-2.5 py-2',
        recording.status === 'FAILED' ? 'border-brand-red/40' : '',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[12px] font-medium text-ink-1">
            {startedAt.toLocaleString()}
          </div>
          <div className="text-[10px] text-ink-3">
            By {recording.startedBy.name}
            {duration ? ` · ${duration}` : ''}
            {recording.status === 'RUNNING' ? ' · in progress' : ''}
            {recording.status === 'PENDING' ? ' · starting…' : ''}
            {recording.status === 'FAILED' ? ' · failed' : ''}
            {expired ? ' · expired' : ''}
          </div>
        </div>
        {downloadable ? (
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => downloadMutation.mutate()}
            loading={downloadMutation.isPending}
            aria-label="Download recording"
            title="Download"
          >
            <Download className="h-3.5 w-3.5" strokeWidth={2.25} />
          </Button>
        ) : null}
      </div>
    </li>
  );
}

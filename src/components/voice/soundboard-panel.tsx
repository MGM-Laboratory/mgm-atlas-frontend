'use client';

import * as React from 'react';
import { Loader2, Music2, Play, Plus, Square, Trash2, Upload } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, uploadToPresigned } from '@/lib/api/client';
import { apiPaths } from '@/lib/api/paths';
import { queryKeys } from '@/lib/api/queries';
import { getStoredSession } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useVoice } from '@/lib/voice/voice-provider';
import type { SoundboardPresignResponse, VoiceSoundboardClip } from '@/lib/voice/types';

/**
 * Workspace-wide soundboard popover. Mounted from the controls bar
 * inside a voice room. Reads are open to any authenticated user;
 * upload + delete are admin-only (matches AdminGuard on the backend).
 *
 * Playback path (Phase 6): clicking a clip calls
 * VoiceProvider.playSoundboardClip, which decodes once + caches the
 * AudioBuffer, then routes it through a GainNode into a LiveKit
 * `LocalAudioTrack` published alongside the user's mic. All other
 * participants hear it as if it were the user's own audio.
 */
export function SoundboardPanel() {
  const { state, actions } = useVoice();
  const [open, setOpen] = React.useState(false);
  const session = getStoredSession();
  const isAdmin = session?.user.isAdmin === true;
  const ready = state.connectionState === 'connected';

  const clipsQuery = useQuery({
    queryKey: queryKeys.voice.soundboard,
    queryFn: () =>
      api<{ items: VoiceSoundboardClip[] }>(apiPaths.voice.soundboardClips()).then(
        (r) => r.items,
      ),
    enabled: open,
    staleTime: 30_000,
  });

  const clips = clipsQuery.data ?? [];
  const playing = state.soundboardPlayingClipId;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              disabled={!ready}
              aria-label="Soundboard"
              className={cn(playing ? 'text-brand-blue' : undefined)}
            >
              <Music2 className="h-4 w-4" strokeWidth={2.25} />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Soundboard</TooltipContent>
      </Tooltip>
      <PopoverContent align="center" side="top" className="w-[360px] p-0">
        <div className="flex items-center justify-between gap-2 border-b border-line-2 px-3 py-2">
          <div className="flex items-center gap-2 text-sm font-medium text-ink-1">
            <Music2 className="h-3.5 w-3.5" strokeWidth={2.25} />
            Soundboard
          </div>
          <div className="flex items-center gap-2 text-[11px] text-ink-3">
            <span>Volume</span>
            <input
              type="range"
              min={0}
              max={200}
              step={5}
              value={Math.round(state.soundboardVolume * 100)}
              onChange={(e) =>
                actions.setSoundboardVolume(Number.parseInt(e.target.value, 10) / 100)
              }
              className="w-24"
            />
            <span>{Math.round(state.soundboardVolume * 100)}%</span>
          </div>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-3">
          {clipsQuery.isLoading ? (
            <div className="flex justify-center py-6 text-ink-3">
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.25} />
            </div>
          ) : clips.length === 0 ? (
            <div className="py-6 text-center text-[12px] text-ink-3">
              {isAdmin
                ? 'No clips yet. Upload your first one below.'
                : 'No soundboard clips yet — ask an admin to upload some.'}
            </div>
          ) : (
            <ul className="grid grid-cols-2 gap-2">
              {clips.map((c) => (
                <li key={c.id}>
                  <ClipTile
                    clip={c}
                    isPlaying={c.id === playing}
                    isAdmin={isAdmin}
                    onPlay={() =>
                      void actions.playSoundboardClip({
                        id: c.id,
                        url: c.url,
                        durationMs: c.durationMs,
                      })
                    }
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        {isAdmin ? <UploadSection /> : null}
      </PopoverContent>
    </Popover>
  );
}

function ClipTile({
  clip,
  isPlaying,
  isAdmin,
  onPlay,
}: {
  clip: VoiceSoundboardClip;
  isPlaying: boolean;
  isAdmin: boolean;
  onPlay: () => void;
}) {
  const queryClient = useQueryClient();
  const deleteMutation = useMutation({
    mutationFn: () => api(apiPaths.voice.soundboardClip(clip.id), { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.voice.soundboard });
    },
  });

  const seconds = Math.max(1, Math.round(clip.durationMs / 1000));
  return (
    <div
      className={cn(
        'group/clip relative flex flex-col items-stretch gap-1 rounded-md border border-line-2 bg-surface-1 p-2 text-left transition-colors',
        isPlaying ? 'border-brand-blue ring-1 ring-brand-blue' : 'hover:bg-surface-muted',
      )}
    >
      <button
        type="button"
        onClick={onPlay}
        className="flex items-center gap-2 text-left"
        aria-label={`Play ${clip.name}`}
      >
        <span
          className={cn(
            'inline-grid h-7 w-7 shrink-0 place-items-center rounded-full',
            isPlaying ? 'bg-brand-blue text-white' : 'bg-surface-muted text-ink-2',
          )}
        >
          {isPlaying ? (
            <Square className="h-3 w-3" strokeWidth={2.5} />
          ) : (
            <Play className="h-3 w-3" strokeWidth={2.5} />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium text-ink-1">
            {clip.name}
          </span>
          <span className="block text-[10px] text-ink-3">{seconds}s</span>
        </span>
      </button>
      {isAdmin ? (
        <button
          type="button"
          onClick={() => deleteMutation.mutate()}
          className="absolute right-1 top-1 inline-grid h-5 w-5 place-items-center rounded text-ink-3 opacity-0 transition-opacity hover:bg-brand-red hover:text-white group-hover/clip:opacity-100"
          aria-label="Delete clip"
          title="Delete clip"
        >
          <Trash2 className="h-3 w-3" strokeWidth={2.25} />
        </button>
      ) : null}
    </div>
  );
}

function UploadSection() {
  const queryClient = useQueryClient();
  const [file, setFile] = React.useState<File | null>(null);
  const [name, setName] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const reset = () => {
    setFile(null);
    setName('');
    setError(null);
  };

  const onFileChange = (next: File | null) => {
    setError(null);
    setFile(next);
    if (next && !name) {
      // Default the name to the filename minus extension.
      setName(next.name.replace(/\.[^.]+$/, '').slice(0, 64));
    }
  };

  /**
   * Measure the audio duration client-side via an Audio element so we
   * can send durationMs to the backend register call. Avoids an extra
   * decode pass through Web Audio.
   */
  const measureDurationMs = (f: File) =>
    new Promise<number>((resolve, reject) => {
      const url = URL.createObjectURL(f);
      const audio = new Audio(url);
      audio.preload = 'metadata';
      const cleanup = () => URL.revokeObjectURL(url);
      audio.onloadedmetadata = () => {
        cleanup();
        const ms = Math.round((audio.duration || 0) * 1000);
        if (!ms || !Number.isFinite(ms)) reject(new Error('Could not measure duration.'));
        else resolve(ms);
      };
      audio.onerror = () => {
        cleanup();
        reject(new Error("Couldn't read that audio file."));
      };
    });

  const upload = async () => {
    if (!file || !name.trim()) return;
    setError(null);
    setBusy(true);
    try {
      const duration = await measureDurationMs(file);
      if (duration > 30_000) {
        throw new Error('Clips must be 30 seconds or shorter.');
      }
      const presign = await api<SoundboardPresignResponse>(
        apiPaths.voice.soundboardPresign(),
        {
          method: 'POST',
          body: {
            name: name.trim(),
            contentType: file.type || 'audio/mpeg',
            contentLength: file.size,
          },
        },
      );
      await uploadToPresigned(presign.uploadUrl, file, undefined, file.type || 'audio/mpeg');
      await api(apiPaths.voice.soundboardClips(), {
        method: 'POST',
        body: {
          name: name.trim(),
          s3Key: presign.s3Key,
          durationMs: duration,
        },
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.voice.soundboard });
      reset();
    } catch (err) {
      setError((err as Error).message ?? 'Upload failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border-t border-line-2 bg-surface-muted/40 p-3">
      <div className="mb-2 flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-ink-3">
        <Plus className="h-3 w-3" strokeWidth={2.25} />
        Add clip
      </div>
      <div className="space-y-2">
        <div>
          <Label htmlFor="sb-file" className="text-[11px]">
            Audio file (mp3, wav, ogg — max 30s)
          </Label>
          <Input
            id="sb-file"
            type="file"
            accept="audio/*"
            onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
            className="mt-1 text-[12px]"
          />
        </div>
        <div>
          <Label htmlFor="sb-name" className="text-[11px]">
            Clip name
          </Label>
          <Input
            id="sb-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Air horn"
            maxLength={64}
            className="mt-1"
          />
        </div>
        {error ? (
          <div className="text-[11px] text-brand-red">{error}</div>
        ) : null}
        <Button
          onClick={() => void upload()}
          disabled={!file || !name.trim() || busy}
          loading={busy}
          size="sm"
          className="w-full"
        >
          <Upload className="mr-1.5 h-3 w-3" strokeWidth={2.25} />
          Upload
        </Button>
      </div>
    </div>
  );
}

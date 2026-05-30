'use client';

import * as React from 'react';
import { Mic, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { useVoice } from '@/lib/voice/voice-provider';

/**
 * Per-user voice settings dialog. Loads prefs on mount, debounces
 * PATCH on every change so the toggles feel instant without spamming
 * the backend. Sections:
 *   - Input mode (Voice Activity vs Push-to-Talk + key + release delay)
 *   - Audio cleanup (noise suppression / echo cancellation / AGC)
 *   - Devices (mic + camera + output)
 *   - Mic test (live VU meter + optional loopback playback)
 *   - Keyboard shortcuts (mute / deafen / disconnect)
 */
export function VoiceSettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { state, actions } = useVoice();
  const prefs = state.preferences;

  // Refresh prefs + devices when the dialog opens (user might have
  // plugged in a new headset since the last load).
  React.useEffect(() => {
    if (!open) return;
    void actions.loadPreferences();
    void actions.refreshDevices();
  }, [open, actions]);

  if (!prefs) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogTitle>Voice settings</DialogTitle>
          <DialogDescription>Loading…</DialogDescription>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogTitle>Voice settings</DialogTitle>
        <DialogDescription>
          These preferences sync across all your devices.
        </DialogDescription>

        <div className="mt-4 max-h-[70vh] space-y-6 overflow-y-auto pr-2">
          <InputModeSection />
          <DevicesSection />
          <MicTestSection />
          <AudioCleanupSection />
          <ShortcutsSection />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Input mode ────────────────────────────────────────────────────────

function InputModeSection() {
  const { state, actions } = useVoice();
  const prefs = state.preferences!;
  const [capturingKey, setCapturingKey] = React.useState(false);

  React.useEffect(() => {
    if (!capturingKey) return;
    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      if (e.code === 'Escape') {
        setCapturingKey(false);
        return;
      }
      void actions.updatePreferences({ pttKey: e.code });
      setCapturingKey(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [capturingKey, actions]);

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold text-ink-1">Input mode</h3>
      <div className="space-y-1.5">
        <Label htmlFor="voice-input-mode">When to transmit</Label>
        <Select
          value={prefs.inputMode}
          onValueChange={(v) =>
            void actions.updatePreferences({ inputMode: v as 'VOICE_ACTIVITY' | 'PUSH_TO_TALK' })
          }
        >
          <SelectTrigger id="voice-input-mode">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="VOICE_ACTIVITY">
              Voice activity (always open when unmuted)
            </SelectItem>
            <SelectItem value="PUSH_TO_TALK">Push-to-talk (hold a key)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {prefs.inputMode === 'PUSH_TO_TALK' ? (
        <div className="space-y-3 rounded-md border border-line-2 bg-surface-muted/40 p-3">
          <div className="space-y-1.5">
            <Label htmlFor="voice-ptt-key">Push-to-talk key</Label>
            <button
              id="voice-ptt-key"
              type="button"
              onClick={() => setCapturingKey(true)}
              className={cn(
                'inline-flex h-9 w-full items-center justify-between rounded-md border border-line bg-white px-3 text-sm',
                capturingKey ? 'border-brand-blue text-brand-blue' : 'text-ink-1',
              )}
            >
              <span className="font-mono">
                {capturingKey
                  ? 'Press a key… (Esc to cancel)'
                  : prefs.pttKey || 'Not set — click to bind'}
              </span>
              <span className="text-[11px] text-ink-3">Click to rebind</span>
            </button>
            <p className="text-[11px] text-ink-3">
              PTT only works while this browser tab is focused (OS-global PTT
              needs a desktop app).
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="voice-ptt-release">Release delay (ms)</Label>
            <Input
              id="voice-ptt-release"
              type="number"
              min={0}
              max={2000}
              step={50}
              defaultValue={prefs.pttReleaseMs}
              onBlur={(e) => {
                const v = Number.parseInt(e.target.value, 10);
                if (!Number.isNaN(v) && v >= 0 && v <= 2000 && v !== prefs.pttReleaseMs) {
                  void actions.updatePreferences({ pttReleaseMs: v });
                }
              }}
            />
            <p className="text-[11px] text-ink-3">
              How long the mic stays open after you release the key. Keeps the
              end of words from being cut off. Default 150ms.
            </p>
          </div>
        </div>
      ) : null}
    </section>
  );
}

// ─── Devices ───────────────────────────────────────────────────────────

function DevicesSection() {
  const { state, actions } = useVoice();
  const prefs = state.preferences!;
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold text-ink-1">Devices</h3>

      <div className="space-y-1.5">
        <Label>Microphone</Label>
        <Select
          value={prefs.micDeviceId ?? 'default'}
          onValueChange={(v) => {
            const id = v === 'default' ? '' : v;
            void actions.updatePreferences({ micDeviceId: id || null });
            if (id) void actions.switchMicDevice(id);
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="default">System default</SelectItem>
            {state.devices.mics.map((d) => (
              <SelectItem key={d.deviceId} value={d.deviceId}>
                {d.label || `Microphone ${d.deviceId.slice(0, 6)}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label>Camera</Label>
        <Select
          value={prefs.cameraDeviceId ?? 'default'}
          onValueChange={(v) => {
            const id = v === 'default' ? '' : v;
            void actions.updatePreferences({ cameraDeviceId: id || null });
            if (id) void actions.switchCameraDevice(id);
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="default">System default</SelectItem>
            {state.devices.cameras.map((d) => (
              <SelectItem key={d.deviceId} value={d.deviceId}>
                {d.label || `Camera ${d.deviceId.slice(0, 6)}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label>Speakers (output)</Label>
        <Select
          value={prefs.outputDeviceId ?? 'default'}
          onValueChange={(v) => {
            const id = v === 'default' ? '' : v;
            void actions.updatePreferences({ outputDeviceId: id || null });
            if (id) void actions.switchOutputDevice(id);
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="default">System default</SelectItem>
            {state.devices.outputs.map((d) => (
              <SelectItem key={d.deviceId} value={d.deviceId}>
                {d.label || `Speakers ${d.deviceId.slice(0, 6)}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[11px] text-ink-3">
          Firefox doesn&apos;t support output-device selection.
        </p>
      </div>
    </section>
  );
}

// ─── Mic test ──────────────────────────────────────────────────────────

function MicTestSection() {
  const { state } = useVoice();
  const prefs = state.preferences!;
  const [testing, setTesting] = React.useState(false);
  const [loopback, setLoopback] = React.useState(false);
  const [level, setLevel] = React.useState(0);
  const streamRef = React.useRef<MediaStream | null>(null);
  const audioCtxRef = React.useRef<AudioContext | null>(null);
  const rafRef = React.useRef<number | null>(null);
  const audioElRef = React.useRef<HTMLAudioElement | null>(null);

  const stop = React.useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (audioCtxRef.current) {
      void audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
    if (streamRef.current) {
      for (const t of streamRef.current.getTracks()) t.stop();
      streamRef.current = null;
    }
    if (audioElRef.current) {
      audioElRef.current.srcObject = null;
    }
    setLevel(0);
    setTesting(false);
  }, []);

  const start = React.useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: prefs.micDeviceId ? { exact: prefs.micDeviceId } : undefined,
          noiseSuppression: prefs.noiseSuppression,
          echoCancellation: prefs.echoCancellation,
          autoGainControl: prefs.autoGainControl,
        },
      });
      streamRef.current = stream;
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      src.connect(analyser);
      const buf = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteTimeDomainData(buf);
        // RMS in [0..1]
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / buf.length);
        setLevel(Math.min(1, rms * 2));
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
      // Loopback playback (off by default — feedback risk on speakers).
      if (loopback && audioElRef.current) {
        audioElRef.current.srcObject = stream;
        await audioElRef.current.play().catch(() => undefined);
      }
      setTesting(true);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('Mic test failed:', err);
    }
  }, [prefs.micDeviceId, prefs.noiseSuppression, prefs.echoCancellation, prefs.autoGainControl, loopback]);

  React.useEffect(() => () => stop(), [stop]);

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold text-ink-1">Test your microphone</h3>
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant={testing ? 'danger' : 'secondary'}
          onClick={() => (testing ? stop() : start())}
        >
          {testing ? (
            <>
              <Square className="mr-2 h-3.5 w-3.5" strokeWidth={2.5} />
              Stop test
            </>
          ) : (
            <>
              <Mic className="mr-2 h-3.5 w-3.5" strokeWidth={2.5} />
              Start test
            </>
          )}
        </Button>
        <label className="inline-flex items-center gap-1.5 text-[12px] text-ink-3">
          <input
            type="checkbox"
            checked={loopback}
            onChange={(e) => setLoopback(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-line"
          />
          Hear myself (loopback)
        </label>
      </div>

      <div className="h-3 w-full overflow-hidden rounded-full bg-surface-muted">
        <div
          className="h-full transition-all duration-75 ease-out"
          style={{
            width: `${Math.round(level * 100)}%`,
            background:
              level > 0.7
                ? '#e53e3e'
                : level > 0.4
                  ? '#48bb78'
                  : '#3182ce',
          }}
        />
      </div>
      <p className="text-[11px] text-ink-3">
        {testing
          ? 'Speak normally. If the bar moves, your mic is working.'
          : 'Click Start to test the selected microphone without joining a call.'}
      </p>
      <audio ref={audioElRef} style={{ display: 'none' }} />
    </section>
  );
}

// ─── Audio cleanup ─────────────────────────────────────────────────────

function AudioCleanupSection() {
  const { state, actions } = useVoice();
  const prefs = state.preferences!;
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold text-ink-1">Audio cleanup</h3>
      <p className="text-[11px] text-ink-3">
        Changes apply the next time you join a voice channel.
      </p>
      <ToggleRow
        label="Noise suppression"
        description="Filter out keyboard clicks, fans, and other background noise."
        value={prefs.noiseSuppression}
        onChange={(v) => void actions.updatePreferences({ noiseSuppression: v })}
      />
      <ToggleRow
        label="Echo cancellation"
        description="Stops your mic from picking up the audio of other speakers."
        value={prefs.echoCancellation}
        onChange={(v) => void actions.updatePreferences({ echoCancellation: v })}
      />
      <ToggleRow
        label="Automatic gain control"
        description="Smooths out volume so quiet voices come through louder."
        value={prefs.autoGainControl}
        onChange={(v) => void actions.updatePreferences({ autoGainControl: v })}
      />
    </section>
  );
}

// ─── Keyboard shortcuts ────────────────────────────────────────────────

function ShortcutsSection() {
  const { state } = useVoice();
  const prefs = state.preferences!;
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold text-ink-1">Keyboard shortcuts</h3>
      <p className="text-[11px] text-ink-3">
        Active while a voice call is connected. Ignored when typing in inputs.
      </p>
      <ShortcutRow label="Toggle mute" value={prefs.shortcutMute ?? 'ctrl+shift+m'} />
      <ShortcutRow label="Toggle deafen" value={prefs.shortcutDeafen ?? 'ctrl+shift+d'} />
      <ShortcutRow label="Disconnect" value={prefs.shortcutDisconnect ?? 'ctrl+shift+h'} />
    </section>
  );
}

function ShortcutRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-line-2 bg-surface-muted/40 px-3 py-2">
      <span className="text-[13px] text-ink-1">{label}</span>
      <kbd className="rounded border border-line bg-white px-2 py-0.5 font-mono text-[11px] text-ink-2">
        {value}
      </kbd>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex items-start justify-between gap-3 rounded-md border border-line-2 bg-surface-muted/40 px-3 py-2.5">
      <div className="flex-1">
        <div className="text-[13px] font-medium text-ink-1">{label}</div>
        <div className="text-[11px] text-ink-3">{description}</div>
      </div>
      <Switch checked={value} onCheckedChange={onChange} />
    </label>
  );
}

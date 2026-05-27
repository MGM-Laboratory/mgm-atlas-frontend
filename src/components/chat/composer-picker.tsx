'use client';

import * as React from 'react';
import { Smile, Loader2, ImageIcon } from 'lucide-react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { apiPaths } from '@/lib/api/paths';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { ChatGif, ChatGifSearchResult, Sticker, StickerPack } from '@/lib/types';

// Lazy-load the emoji picker — it's ~600KB and only needed when the
// popover opens. Loading on the main bundle would punish every chat
// view, not just users that open the picker.
const EmojiPicker = React.lazy(() => import('emoji-picker-react'));

interface Props {
  /** Called with the emoji character (e.g. "👍") to insert at the caret. */
  onEmojiPick: (emoji: string) => void;
  /** Called with the GIF URL to insert into the message body. */
  onGifPick: (gif: ChatGif) => void;
  /** Called when the user picks a sticker — attaches it as an inline image. */
  onStickerPick: (sticker: Sticker) => void;
}

/**
 * Three-tab picker (Emoji / GIF / Sticker) anchored on the composer's
 * smile button. Mirrors the WhatsApp pattern. Sticker tab is a stub
 * for P3 — stickers ship in P5 (admin upload UI + sticker API). When
 * the GIF tab is disabled (TENOR_API_KEY unset on the server), the
 * tab still renders but says so plainly.
 */
export function ComposerPicker({ onEmojiPick, onGifPick, onStickerPick }: Props) {
  const [open, setOpen] = React.useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="icon-sm" variant="ghost" aria-label="Emoji, GIF, sticker">
          <Smile className="h-4 w-4" strokeWidth={2.25} />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        // Anchor on the bottom-left of the smile button: popover sits
        // above the trigger (composer is at the bottom of the screen, so
        // "below" would clip) and extends RIGHTWARD across the composer
        // instead of jutting off the left edge.
        side="top"
        align="start"
        sideOffset={8}
        collisionPadding={16}
        avoidCollisions
        className="w-[340px] max-w-[calc(100vw-2rem)] overflow-hidden p-0"
      >
        <Tabs defaultValue="emoji" className="flex flex-col">
          {/* Add breathing room around the tab strip so the labels aren't
              flush against the popover's left edge. */}
          <TabsList className="gap-4 border-b border-line px-3 pt-2">
            <TabsTrigger value="emoji">Emoji</TabsTrigger>
            <TabsTrigger value="gif">GIF</TabsTrigger>
            <TabsTrigger value="sticker">Sticker</TabsTrigger>
          </TabsList>
          <TabsContent value="emoji" className="mt-0 p-0">
            <React.Suspense
              fallback={
                <div className="grid h-[360px] place-items-center text-ink-3">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              }
            >
              <EmojiPicker
                onEmojiClick={(e) => {
                  onEmojiPick(e.emoji);
                  setOpen(false);
                }}
                width="100%"
                height={360}
                lazyLoadEmojis
              />
            </React.Suspense>
          </TabsContent>
          <TabsContent value="gif" className="mt-0 p-2">
            <GifTab
              onPick={(g) => {
                onGifPick(g);
                setOpen(false);
              }}
            />
          </TabsContent>
          <TabsContent value="sticker" className="mt-0 p-2">
            <StickerTab
              onPick={(s) => {
                onStickerPick(s);
                setOpen(false);
              }}
            />
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}

function GifTab({ onPick }: { onPick: (gif: ChatGif) => void }) {
  const [q, setQ] = React.useState('');
  const debounced = useDebounced(q, 300);

  const configQuery = useQuery({
    queryKey: ['chat', 'gifs', 'config'],
    queryFn: () => api<{ available: boolean }>(apiPaths.chat.gifsConfig()),
    staleTime: 60 * 60 * 1000,
    retry: false,
  });

  const search = useInfiniteQuery({
    queryKey: ['chat', 'gifs', 'q', debounced],
    enabled: configQuery.data?.available !== false,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api<ChatGifSearchResult>(
        debounced.trim().length === 0
          ? apiPaths.chat.gifsTrending(pageParam)
          : apiPaths.chat.gifsSearch(debounced.trim(), pageParam),
      ),
    getNextPageParam: (last: ChatGifSearchResult) => last.next ?? undefined,
  });

  if (configQuery.data?.available === false) {
    return (
      <div className="grid h-[320px] place-items-center px-4 text-center text-[13px] text-ink-3">
        GIF search isn’t configured on this server.
      </div>
    );
  }

  const gifs = search.data?.pages.flatMap((p) => p.results) ?? [];

  return (
    <div className="flex h-[360px] flex-col gap-2">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search GIFs"
        className="rounded border border-line bg-white px-2 py-1.5 text-[13px] outline-none focus:border-line-strong"
      />
      <div className="grid flex-1 grid-cols-2 gap-1.5 overflow-y-auto pr-1">
        {gifs.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => onPick(g)}
            className="overflow-hidden rounded border border-line hover:border-brand-blue/50"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={g.previewUrl} alt={g.title} loading="lazy" className="block h-full w-full object-cover" />
          </button>
        ))}
        {search.isLoading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={`s-${i}`} className="h-20 animate-pulse rounded bg-line/40" />
            ))
          : null}
      </div>
      {search.hasNextPage ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void search.fetchNextPage()}
          loading={search.isFetchingNextPage}
        >
          More
        </Button>
      ) : null}
    </div>
  );
}

function StickerTab({ onPick }: { onPick: (sticker: Sticker) => void }) {
  const packsQuery = useQuery({
    queryKey: ['chat', 'stickers', 'packs'],
    queryFn: () => api<StickerPack[]>(apiPaths.chat.stickerPacks()),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const packs = packsQuery.data ?? [];
  const totalStickers = packs.reduce((s, p) => s + p.stickers.length, 0);

  if (packsQuery.isLoading) {
    return (
      <div className="grid h-[320px] place-items-center text-ink-3">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }

  if (totalStickers === 0) {
    return (
      <div className="grid h-[320px] place-items-center px-4 text-center text-[13px] text-ink-3">
        <div className="space-y-1">
          <ImageIcon className="mx-auto h-6 w-6 text-ink-4" strokeWidth={2.25} />
          <div>No stickers yet.</div>
          <div className="text-[11px]">Admins can upload packs from the admin panel.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[360px] space-y-3 overflow-y-auto pr-1">
      {packs
        .filter((p) => p.stickers.length > 0)
        .map((pack) => (
          <div key={pack.id}>
            <div className="mb-1 px-1 text-[11px] font-medium uppercase tracking-[0.06em] text-ink-3">
              {pack.name}
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {pack.stickers.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onPick(s)}
                  title={s.name}
                  className="aspect-square overflow-hidden rounded border border-line hover:border-brand-blue/50"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={s.url}
                    alt={s.name}
                    loading="lazy"
                    className="block h-full w-full object-contain"
                  />
                </button>
              ))}
            </div>
          </div>
        ))}
    </div>
  );
}

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

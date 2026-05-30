'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowLeft, Volume2 } from 'lucide-react';
import { ChannelList } from '@/components/chat/channel-list';
import { VoiceRoom } from './voice-room';

interface Props {
  projectSlug: string;
  projectTitle: string;
  projectId: string;
  channelId: string;
  channelName: string;
  channelTopic: string | null;
  isManager: boolean;
}

/**
 * Per-project voice page layout: ChannelList sidebar on the left
 * (showing both text + voice channels), VoiceRoom in the right pane.
 * Mirrors ChatLayout so the user can switch channels mid-call without
 * losing context.
 */
export function VoiceLayout({
  projectSlug,
  projectTitle,
  projectId,
  channelId,
  channelName,
  channelTopic,
  isManager,
}: Props) {
  return (
    <div className="flex h-full min-h-0">
      <ChannelList
        projectSlug={projectSlug}
        projectTitle={projectTitle}
        activeChannelId={channelId}
        canManage={isManager}
      />

      <section className="flex min-w-0 flex-1 flex-col bg-white">
        <header className="flex items-center gap-3 border-b border-line px-6 py-3">
          <Link
            href={`/projects/${projectSlug}` as never}
            className="inline-flex items-center gap-1 text-[12px] text-ink-3 hover:text-ink"
          >
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2.25} />
            Project
          </Link>

          <div className="h-4 w-px bg-line" />
          <Volume2 className="h-4 w-4 text-ink-3" strokeWidth={2.25} />
          <h1 className="text-[15px] font-semibold text-ink">{channelName}</h1>
          {channelTopic ? (
            <span className="hidden truncate text-[13px] text-ink-3 md:inline">
              · {channelTopic}
            </span>
          ) : null}
        </header>

        <div className="min-h-0 flex-1 overflow-auto">
          <VoiceRoom channelId={channelId} channelName={channelName} projectId={projectId} />
        </div>
      </section>
    </div>
  );
}

'use client';

import * as React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import { cn } from '@/lib/utils';

const MENTION_REGEX = /@\[([^\]]+)\]\(([0-9a-f-]{8,})\)/g;

/**
 * Renders GFM markdown with two PMO-specific augmentations:
 *
 *  1. `@[name](userId)` mention tokens become inline pills before
 *     react-markdown sees them. We do this with a pre-pass that splits
 *     the text into segments + replaces mention tokens with a sentinel
 *     `@@MENTION-<uuid>::<name>@@`, then a custom `text` renderer turns
 *     the sentinels back into <span> pills. Avoids embedding raw HTML.
 *
 *  2. rehype-sanitize strips anything unsafe (script tags, on* handlers,
 *     unknown protocols). Keeps PRE/CODE/A/IMG/H1-6/UL/LI etc.
 *
 * Use this for comment bodies. Task descriptions render through the
 * existing Tiptap RichTextEditor in read-only mode and don't go through
 * here.
 */
export function MarkdownRender({
  markdown,
  className,
}: {
  markdown: string;
  className?: string;
}) {
  const prepared = React.useMemo(() => prepareMentions(markdown), [markdown]);
  return (
    <div className={cn('prose prose-sm max-w-none text-ink prose-a:text-brand-blue', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={{
          a: ({ href, children, ...rest }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" {...rest}>
              {children}
            </a>
          ),
          // Default `code` handles inline + block; rely on prose-sm styling.
          text: ({ children }) => <MentionAwareText>{children as React.ReactNode}</MentionAwareText>,
        }}
      >
        {prepared}
      </ReactMarkdown>
    </div>
  );
}

function prepareMentions(input: string): string {
  // Replace `@[name](uuid)` with a sentinel that won't be parsed as a
  // link by remark. We restore the pill in the text renderer below.
  return input.replace(MENTION_REGEX, (_match, name, id) =>
    `@@MENTION-${id}::${name.replace(/::/g, ': ')}@@`,
  );
}

function MentionAwareText({ children }: { children: React.ReactNode }) {
  // react-markdown passes text content as the only child. Walk for sentinels.
  if (typeof children !== 'string') return <>{children}</>;
  const text = children;
  const re = /@@MENTION-([0-9a-f-]{8,})::([^@]+?)@@/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > lastIndex) parts.push(text.slice(lastIndex, m.index));
    parts.push(
      <span
        key={`${m[1]}-${m.index}`}
        className="inline-flex items-center rounded bg-brand-blue-50 px-1 py-0.5 text-[12px] font-medium text-brand-blue"
        title={`User mention: ${m[1]}`}
      >
        @{m[2]}
      </span>,
    );
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return <>{parts}</>;
}

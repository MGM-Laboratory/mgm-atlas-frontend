'use client';

import * as React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import { EmbedFor, isEmbeddable } from './embed-renderer';

/**
 * Renders a chat message body. The pipeline:
 *
 *   1. Pre-scan for lines that are nothing but a bare URL to a known
 *      provider (YouTube/Vimeo/Tenor/Giphy). Those lines are stripped
 *      from the markdown and rendered as a dedicated embed block, so
 *      the link itself doesn't render twice.
 *   2. The rest goes through react-markdown + remark-gfm with strict
 *      rehype-sanitize. Links open in a new tab.
 *
 * The sanitizer schema is the GitHub default minus iframe/object/
 * embed/script — those are handled by our own EmbedFor component.
 */
const SANITIZE_SCHEMA = {
  ...defaultSchema,
  // Tighten attributes a touch — no inline styles, no on* handlers.
  attributes: {
    ...defaultSchema.attributes,
    '*': (defaultSchema.attributes?.['*'] ?? []).filter(
      (a) => a !== 'className' && a !== 'class' && a !== 'style',
    ),
  },
};

interface Props {
  markdown: string;
}

interface Segment {
  type: 'md' | 'embed';
  value: string;
}

/**
 * Mentions are serialised as `@[Name](userId)` by the composer (the
 * server's notification parser keys on this exact shape). For the
 * renderer we transform to `**@Name**` so they render as a styled
 * bold token — userId metadata only matters on the server.
 */
const MENTION_REGEX = /@\[([^\]]+)\]\([0-9a-f-]{8,}\)/g;

function transformMentions(input: string): string {
  return input.replace(MENTION_REGEX, '**@$1**');
}

export function MarkdownBody({ markdown }: Props) {
  const segments = React.useMemo(
    () => splitEmbeds(transformMentions(markdown)),
    [markdown],
  );
  return (
    <div className="chat-md whitespace-pre-wrap break-words text-[14px] leading-relaxed text-ink">
      {segments.map((seg, i) =>
        seg.type === 'embed' ? (
          <EmbedFor key={`e-${i}`} url={seg.value} />
        ) : (
          <ReactMarkdown
            key={`m-${i}`}
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[[rehypeSanitize, SANITIZE_SCHEMA]]}
            components={{
              a: (props) => (
                <a
                  {...props}
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand-blue underline-offset-2 hover:underline"
                />
              ),
              p: (props) => <p {...props} className="my-0" />,
              code: (props) => (
                <code
                  {...props}
                  className="rounded bg-surface-muted px-1 py-0.5 font-mono text-[0.875em]"
                />
              ),
              pre: (props) => (
                <pre
                  {...props}
                  className="my-1 overflow-x-auto rounded-md bg-surface-muted p-2 font-mono text-[12px]"
                />
              ),
              ul: (props) => <ul {...props} className="my-1 list-disc pl-5" />,
              ol: (props) => <ol {...props} className="my-1 list-decimal pl-5" />,
              blockquote: (props) => (
                <blockquote
                  {...props}
                  className="my-1 border-l-2 border-line-strong pl-2 text-ink-2"
                />
              ),
            }}
          >
            {seg.value}
          </ReactMarkdown>
        ),
      )}
    </div>
  );
}

/**
 * Walk through the markdown line by line. Any line that — after trim —
 * is just a bare URL to an embeddable provider becomes its own segment
 * so the renderer can swap it for an iframe / inline image. Everything
 * else stays as markdown.
 */
function splitEmbeds(markdown: string): Segment[] {
  const out: Segment[] = [];
  let buf: string[] = [];
  const flushBuf = () => {
    if (buf.length === 0) return;
    out.push({ type: 'md', value: buf.join('\n') });
    buf = [];
  };
  for (const line of markdown.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed && /^https?:\/\/\S+$/.test(trimmed) && isEmbeddable(trimmed)) {
      flushBuf();
      out.push({ type: 'embed', value: trimmed });
    } else {
      buf.push(line);
    }
  }
  flushBuf();
  return out;
}

import { cn } from '@/lib/utils';

interface Props {
  className?: string;
  /** Show a small shape signature next to the wordmark. */
  withSignature?: boolean;
}

/**
 * MGM Atlas wordmark. Each letter rendered in one brand color, in display
 * font, slightly tracked-tight per spec.
 */
export function Wordmark({ className, withSignature = true }: Props) {
  return (
    <div className={cn('inline-flex items-center gap-2', className)} aria-label="MGM Atlas">
      <span className="font-display text-[20px] font-semibold leading-none tracking-[-0.02em]">
        <span style={{ color: '#3a6dc5' }}>A</span>
        <span style={{ color: '#f7bf33' }}>t</span>
        <span style={{ color: '#f94141' }}>l</span>
        <span style={{ color: '#0f8657' }}>a</span>
        <span className="text-ink">s</span>
      </span>
      {withSignature ? (
        <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-ink-3">
          MGM Lab
        </span>
      ) : null}
    </div>
  );
}

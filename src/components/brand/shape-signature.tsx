import { cn } from '@/lib/utils';

interface Props {
  className?: string;
  size?: number;
  /** Hide from screen readers — these are decorative by default. */
  decorative?: boolean;
}

/**
 * The four-shape MGM signature: triangle (blue), square (yellow), circle (red),
 * X (green). Used as the favicon-scale brand mark and in tight footers.
 */
export function ShapeSignature({ className, size = 24, decorative = true }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden={decorative ? 'true' : undefined}
      role={decorative ? undefined : 'img'}
      className={cn('shrink-0', className)}
    >
      {/* Triangle — blue */}
      <path d="M11 2 L20 19 L2 19 Z" fill="#3a6dc5" />
      {/* Square — yellow */}
      <rect x="27" y="2" width="18" height="18" fill="#f7bf33" />
      {/* Circle — red */}
      <circle cx="11" cy="36" r="10" fill="#f94141" />
      {/* X — green */}
      <path
        d="M28 28 L46 46 M46 28 L28 46"
        stroke="#0f8657"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}

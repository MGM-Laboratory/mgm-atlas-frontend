'use client';

import * as React from 'react';
import * as RadixToast from '@radix-ui/react-toast';
import { cva, type VariantProps } from 'class-variance-authority';
import { CircleAlert, CircleCheck, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const toastVariants = cva(
  [
    'pointer-events-auto relative flex w-full max-w-[360px] items-start gap-3 overflow-hidden',
    'rounded bg-white p-4 pr-10 shadow-2 border border-line',
    'data-[state=open]:animate-fade-up data-[state=closed]:animate-fade-in',
  ],
  {
    variants: {
      tone: {
        neutral: 'border-l-4 border-l-line-strong',
        info: 'border-l-4 border-l-brand-blue',
        success: 'border-l-4 border-l-brand-green',
        warning: 'border-l-4 border-l-brand-yellow',
        danger: 'border-l-4 border-l-brand-red',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

type Tone = NonNullable<VariantProps<typeof toastVariants>['tone']>;

export interface ToastItem {
  id: string;
  tone?: Tone;
  title: string;
  description?: string;
}

interface Ctx {
  show: (item: Omit<ToastItem, 'id'>) => void;
}
const ToastContext = React.createContext<Ctx | null>(null);

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastItem[]>([]);
  const show = React.useCallback((item: Omit<ToastItem, 'id'>) => {
    const id = Math.random().toString(36).slice(2);
    setItems((prev) => [...prev.slice(-2), { ...item, id }]);
  }, []);

  const ctx = React.useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={ctx}>
      <RadixToast.Provider duration={6000} swipeDirection="right">
        {children}
        {items.map((t) => (
          <RadixToast.Root
            key={t.id}
            className={cn(toastVariants({ tone: t.tone ?? 'neutral' }))}
            onOpenChange={(open) => {
              if (!open) setItems((prev) => prev.filter((x) => x.id !== t.id));
            }}
          >
            <ToastIcon tone={t.tone ?? 'neutral'} />
            <div className="flex-1 pt-px">
              <RadixToast.Title className="text-[15px] font-medium text-ink">
                {t.title}
              </RadixToast.Title>
              {t.description ? (
                <RadixToast.Description className="mt-0.5 text-[13px] text-ink-2">
                  {t.description}
                </RadixToast.Description>
              ) : null}
            </div>
            <RadixToast.Close
              className="absolute right-2 top-2 inline-grid h-7 w-7 place-items-center rounded text-ink-3 hover:bg-surface-muted"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </RadixToast.Close>
          </RadixToast.Root>
        ))}
        <RadixToast.Viewport className="fixed bottom-4 right-4 z-[60] flex w-[360px] max-w-[calc(100vw-32px)] flex-col gap-2 outline-none" />
      </RadixToast.Provider>
    </ToastContext.Provider>
  );
}

function ToastIcon({ tone }: { tone: Tone }) {
  const cls = 'h-5 w-5 shrink-0 mt-px';
  switch (tone) {
    case 'success':
      return <CircleCheck className={cn(cls, 'text-brand-green')} />;
    case 'danger':
      return <CircleAlert className={cn(cls, 'text-brand-red')} />;
    case 'warning':
      return <CircleAlert className={cn(cls, 'text-brand-yellow-ink')} />;
    case 'info':
      return <Info className={cn(cls, 'text-brand-blue')} />;
    default:
      return <Info className={cn(cls, 'text-ink-3')} />;
  }
}

import type { Metadata } from 'next';
import { ShapeSignature } from '@/components/brand/shape-signature';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Status',
  robots: { index: false, follow: false },
};

interface HealthPayload {
  status: 'ok' | 'error' | 'shutting_down';
  info: Record<string, { status: string }>;
  error: Record<string, { status: string; error?: string }>;
  details: Record<string, { status: string; error?: string }>;
}

async function fetchHealth(): Promise<HealthPayload | null> {
  try {
    const url = `${process.env.NEXT_PUBLIC_API_URL ?? ''}/health`;
    const res = await fetch(url, { cache: 'no-store' });
    return (await res.json()) as HealthPayload;
  } catch {
    return null;
  }
}

export default async function StatusPage() {
  const data = await fetchHealth();
  const isUp = data?.status === 'ok';
  const details = data?.details && typeof data.details === 'object' ? data.details : null;
  const detailEntries = details ? Object.entries(details) : [];

  return (
    <main className="grid min-h-svh place-items-center bg-white px-6">
      <div className="w-full max-w-md text-center">
        <ShapeSignature size={36} className="mx-auto" />
        <h1
          className={`mt-5 font-display text-display-lg tracking-[-0.02em] ${
            isUp ? 'text-ink' : 'text-brand-red'
          }`}
        >
          {isUp ? 'All systems operational' : 'Service degraded'}
        </h1>
        <p className="mt-3 text-body text-ink-2">
          MGM Atlas API health, observed in real time.
        </p>

        {detailEntries.length > 0 ? (
          <ul className="mt-8 divide-y divide-line rounded-lg border border-line bg-white text-left">
            {detailEntries.map(([key, value]) => {
              const ok = value.status === 'up';
              return (
                <li key={key} className="flex items-center justify-between px-5 py-3">
                  <span className="text-[14px] font-medium capitalize text-ink">{key}</span>
                  <span
                    className={`inline-flex items-center gap-2 text-[13px] font-medium ${
                      ok ? 'text-brand-green' : 'text-brand-red'
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${
                        ok ? 'bg-brand-green' : 'bg-brand-red'
                      }`}
                    />
                    {ok ? 'Up' : (value.error ?? 'Down')}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-6 rounded border border-brand-red bg-brand-red-50 px-4 py-3 text-[13px] text-brand-red">
            Could not reach the API health endpoint.
          </p>
        )}

        <p className="mt-8 text-[12px] text-ink-3">
          This page is polled by Gatus. Refresh to re-check.
        </p>
      </div>
    </main>
  );
}

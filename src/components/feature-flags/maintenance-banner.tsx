'use client';

import { AlertTriangle } from 'lucide-react';
import { useFeatureFlag } from '@/lib/hooks/use-feature-flags';

/**
 * Site-wide maintenance banner, gated by the `ui.maintenance_banner` feature
 * flag. Renders nothing unless the flag is on, so it ships dark and an admin
 * can flip it from the console without a redeploy. Doubles as the proof that
 * the feature-flag pipeline works end-to-end.
 */
export function MaintenanceBanner() {
  const enabled = useFeatureFlag('ui.maintenance_banner');
  if (!enabled) return null;

  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 bg-brand-yellow px-4 py-2 text-center text-body-sm font-medium text-ink"
    >
      <AlertTriangle className="h-4 w-4 shrink-0" strokeWidth={2.25} />
      <span>Atlas is undergoing scheduled maintenance — some features may be briefly unavailable.</span>
    </div>
  );
}

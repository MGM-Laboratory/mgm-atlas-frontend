'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { apiPaths } from '@/lib/api/paths';
import type { FeatureFlagMap } from '@/lib/types';

/**
 * Public evaluated feature-flag map. Fail-safe: on any error the map is empty,
 * so `useFeatureFlag` returns false (a flag never silently turns on because a
 * fetch failed). 30s staleTime mirrors the backend cache.
 */
export function useFeatureFlags() {
  return useQuery<FeatureFlagMap>({
    queryKey: ['feature-flags'],
    queryFn: () => api<FeatureFlagMap>(apiPaths.featureFlags()),
    staleTime: 30_000,
    retry: 1,
    // No session needed (public endpoint); safe to run anywhere.
  });
}

/** Convenience: is a single flag enabled? Defaults to false while loading/erroring. */
export function useFeatureFlag(key: string): boolean {
  const { data } = useFeatureFlags();
  return data?.[key] ?? false;
}

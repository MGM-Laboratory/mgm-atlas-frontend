import { NextResponse } from 'next/server';

// Never cache — this must reflect the running build at request time.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Build-identity endpoint, mirror of the backend's GET /api/v1/version.
 * Values are baked from Docker build-args at image build time (empty/`dev`
 * for local `next dev`). The deploy pipeline polls this until `sha` matches
 * the released commit to confirm the frontend has converged.
 *
 * Reachable in production because nginx routes only `/api/v1` to the backend;
 * `/api/version` falls through to the Next server.
 */
export function GET() {
  return NextResponse.json(
    {
      sha: process.env.GIT_SHA ?? 'dev',
      version: process.env.APP_VERSION ?? 'unknown',
      builtAt: process.env.BUILD_TIME ?? '',
    },
    { headers: { 'cache-control': 'no-store' } },
  );
}

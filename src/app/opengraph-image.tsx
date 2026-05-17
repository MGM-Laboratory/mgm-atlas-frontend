import { ImageResponse } from 'next/og';
import { BRAND_LOGO_DATA_URL } from '@/lib/brand-logo';

// Generated 1200x630 PNG OG card used by Slack, iMessage, Twitter, LinkedIn,
// and friends. Next.js convention only accepts raster for opengraph-image, so
// we render the brand SVG into a PNG via Satori. Renders on demand and is
// cached by Next.js.
export const alt = 'MGM Atlas — Project Portfolio';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '80px',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={BRAND_LOGO_DATA_URL} width={260} height={260} alt="" />
        <div
          style={{
            marginTop: 40,
            fontSize: 88,
            fontWeight: 600,
            color: '#0e1116',
            letterSpacing: '-0.025em',
          }}
        >
          MGM Atlas
        </div>
        <div
          style={{
            marginTop: 14,
            fontSize: 30,
            color: '#6b7280',
          }}
        >
          The project portfolio dashboard for MGM Laboratory
        </div>
      </div>
    ),
    size,
  );
}

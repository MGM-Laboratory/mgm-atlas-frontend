import { ImageResponse } from 'next/og';
import { BRAND_LOGO_DATA_URL } from '@/lib/brand-logo';

// Apple touch icon. Convention requires PNG (SVG not accepted for apple-icon),
// so we render the brand SVG to PNG via Satori. 180x180 with 15px breathing
// room on each side keeps the colored shapes from kissing the rounded corners
// iOS draws over the icon.
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default async function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={BRAND_LOGO_DATA_URL} width={150} height={150} alt="" />
      </div>
    ),
    size,
  );
}

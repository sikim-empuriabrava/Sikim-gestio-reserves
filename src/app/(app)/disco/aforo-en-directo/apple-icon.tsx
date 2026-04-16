import { ImageResponse } from 'next/og';

export const size = {
  width: 180,
  height: 180,
};

export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0f172a',
          borderRadius: 36,
          color: '#34d399',
          fontSize: 78,
          fontWeight: 800,
          letterSpacing: '-0.06em',
        }}
      >
        AF
      </div>
    ),
    {
      ...size,
    },
  );
}

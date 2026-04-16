import { ImageResponse } from 'next/og';

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0f172a 0%, #111827 50%, #1e293b 100%)',
          borderRadius: 36,
          color: '#34d399',
          fontSize: 84,
          fontWeight: 800,
          letterSpacing: '-0.06em',
        }}
      >
        AF
      </div>
    ),
    {
      width: 192,
      height: 192,
    },
  );
}

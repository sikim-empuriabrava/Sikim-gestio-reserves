import { ImageResponse } from 'next/og';

const BRAND_LOGO_PATH = '/disco/aforo-en-directo/branding/sikim-app-logo.svg';

export function buildPwaBrandIconResponse(request: Request, size: number) {
  const logoUrl = new URL(BRAND_LOGO_PATH, request.url).toString();

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#020617',
        backgroundImage: `url(${logoUrl})`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center',
        backgroundSize: 'contain',
      }}
    />,
    {
      width: size,
      height: size,
    },
  );
}

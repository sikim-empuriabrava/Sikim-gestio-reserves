import { ImageResponse } from 'next/og';

import { PwaBrandIcon } from '../pwaBrandIcon';

export async function GET() {
  return new ImageResponse(
    <PwaBrandIcon size={192} borderRadius={40} />,
    {
      width: 192,
      height: 192,
    },
  );
}

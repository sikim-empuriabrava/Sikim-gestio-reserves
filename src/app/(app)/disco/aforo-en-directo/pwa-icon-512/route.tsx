import { ImageResponse } from 'next/og';

import { PwaBrandIcon } from '../pwaBrandIcon';

export async function GET() {
  return new ImageResponse(
    <PwaBrandIcon size={512} borderRadius={108} />,
    {
      width: 512,
      height: 512,
    },
  );
}

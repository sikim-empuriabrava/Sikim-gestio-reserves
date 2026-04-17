import { ImageResponse } from 'next/og';

import { PwaBrandIcon } from '../pwaBrandIcon';

export async function GET() {
  return new ImageResponse(
    <PwaBrandIcon size={180} borderRadius={42} />,
    {
      width: 180,
      height: 180,
    },
  );
}

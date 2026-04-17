import { buildPwaBrandIconResponse } from '../pwaBrandingAsset';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  return buildPwaBrandIconResponse(request, 512);
}

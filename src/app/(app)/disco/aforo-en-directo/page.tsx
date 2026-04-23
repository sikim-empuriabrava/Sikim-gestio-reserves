import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { canManageLiveCapacity, canViewLiveCapacity, getAllowlistRoleForUserEmail, getDefaultModulePath } from '@/lib/auth/requireRole';
import { getLiveCapacityState } from '@/lib/disco/liveCapacity';
import { createSupabaseServerClient } from '@/lib/supabase/server';

import { AforoAuthHeader } from './AforoAuthHeader';
import { AforoInstallCta } from './AforoInstallCta';
import { AforoPwaBootstrap } from './AforoPwaBootstrap';
import { LiveCapacityPanel } from './LiveCapacityPanel';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Sikim Aforo',
  description: 'Control operativo de puerta para aforo en directo.',
  manifest: '/disco/aforo-en-directo/manifest.webmanifest',
  themeColor: '#020617',
  icons: {
    apple: [
      {
        url: '/branding/sikim-app-apple-180.png',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Sikim Aforo',
    startupImage: [],
  },
  formatDetection: {
    telephone: false,
  },
};

export default async function LiveCapacityPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let canManage = false;

  if (user) {
    const requesterEmail = user.email?.trim().toLowerCase();
    if (!requesterEmail) {
      redirect('/login?error=not_allowed');
    }

    const allowlistInfo = await getAllowlistRoleForUserEmail(requesterEmail);

    if (!allowlistInfo.allowlisted || !allowlistInfo.allowedUser?.is_active) {
      redirect('/login?error=not_allowed');
    }

    if (!canViewLiveCapacity(allowlistInfo.role, allowlistInfo.allowedUser)) {
      redirect(getDefaultModulePath(allowlistInfo.allowedUser));
    }

    canManage = canManageLiveCapacity(allowlistInfo.role, allowlistInfo.allowedUser);
  }

  const initialState = await getLiveCapacityState();

  return (
    <div className="space-y-5">
      <AforoPwaBootstrap />

      <AforoAuthHeader
        title="Aforo en directo"
        subtitle="Control operativo de puerta para la sesión activa de discoteca."
        initialEmail={user?.email ?? null}
      />

      <AforoInstallCta />

      <LiveCapacityPanel initialState={initialState} canManage={canManage} />
    </div>
  );
}

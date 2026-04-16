import { redirect } from 'next/navigation';

import { canManageLiveCapacity, canViewLiveCapacity, getAllowlistRoleForUserEmail, getDefaultModulePath } from '@/lib/auth/requireRole';
import { getLiveCapacityState } from '@/lib/disco/liveCapacity';
import { createSupabaseServerClient } from '@/lib/supabase/server';

import { LiveCapacityPanel } from './LiveCapacityPanel';

export const dynamic = 'force-dynamic';

export default async function LiveCapacityPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent('/disco/aforo-en-directo')}`);
  }

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

  const initialState = await getLiveCapacityState();
  const canManage = canManageLiveCapacity(allowlistInfo.role, allowlistInfo.allowedUser);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-white">Aforo en directo</h1>
        <p className="mt-1 text-sm text-slate-400">
          Control operativo de puerta para la sesión activa de discoteca.
        </p>
      </div>

      <LiveCapacityPanel initialState={initialState} canManage={canManage} />
    </div>
  );
}

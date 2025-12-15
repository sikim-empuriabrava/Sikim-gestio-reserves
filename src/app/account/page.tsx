import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export default async function AccountPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm uppercase tracking-wide text-primary-200">Cuenta</p>
        <h1 className="text-2xl font-bold text-white">Tu perfil</h1>
        <p className="text-sm text-slate-400">Información básica de tu sesión actual.</p>
      </div>

      <div className="card space-y-3 p-5">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Email</p>
          <p className="text-base font-semibold text-white">{user.email}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Proveedor</p>
          <p className="text-base text-slate-200">{user.app_metadata?.provider ?? 'Desconocido'}</p>
        </div>
      </div>
    </div>
  );
}

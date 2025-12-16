import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import NuevaReservaClient from './NuevaReservaClient';

export default async function NuevaReservaPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent('/reservas/nueva')}`);
  }

  return <NuevaReservaClient />;
}

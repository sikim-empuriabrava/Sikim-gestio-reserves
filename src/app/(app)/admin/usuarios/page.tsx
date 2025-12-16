import { redirect } from 'next/navigation';
import { ModulePlaceholder } from '@/components/ModulePlaceholder';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const cards = [
  {
    title: 'Usuarios y permisos',
    description: 'Gestiona quién puede acceder a cada módulo y controla niveles de permisos.',
    badge: 'Admin',
  },
  {
    title: 'Controles de acceso',
    description: 'Pronto podrás gestionar roles y permisos para cada área de la operación.',
  },
  {
    title: 'Integraciones',
    description: 'Conexión futura con proveedores, notificaciones y sistemas externos desde un único panel.',
  },
];

export default async function AdminUsuariosPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent('/admin/usuarios')}`);
  }

  return (
    <ModulePlaceholder
      title="Usuarios y permisos"
      subtitle="Configura roles, permisos y acceso a cada módulo desde un único panel."
      cards={cards}
    />
  );
}

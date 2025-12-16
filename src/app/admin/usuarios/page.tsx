import { redirect } from 'next/navigation';
import { ModulePlaceholder } from '@/components/ModulePlaceholder';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const cards = [
  {
    title: 'Usuarios y permisos',
    description: 'Gestiona accesos por equipo, crea invitaciones y revisa actividad reciente de los usuarios.',
    badge: 'Próximamente',
  },
  {
    title: 'Roles predefinidos',
    description: 'Plantillas de permisos para sala, cocina, mantenimiento y administración.',
  },
  {
    title: 'Historial de acceso',
    description: 'Registro de inicios de sesión y acciones clave para cumplir auditorías internas.',
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
      subtitle="Configura accesos, revisa actividad y asigna responsabilidades sin salir del panel."
      cards={cards}
    />
  );
}

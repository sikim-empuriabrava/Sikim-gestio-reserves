import { redirect } from 'next/navigation';
import { ModulePlaceholder } from '@/components/ModulePlaceholder';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const cards = [
  {
    title: 'Panel de administración',
    description: 'Espacio reservado para configurar módulos, revisar métricas y habilitar nuevas funciones.',
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

export default async function AdminPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent('/admin')}`);
  }

  return (
    <ModulePlaceholder
      title="Admin"
      subtitle="Configura la plataforma y desbloquea nuevas capacidades sin salir del panel."
      cards={cards}
    />
  );
}

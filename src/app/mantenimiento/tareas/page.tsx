import { redirect } from 'next/navigation';
import { ModulePlaceholder } from '@/components/ModulePlaceholder';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const cards = [
  {
    title: 'Tareas e incidencias',
    description: 'Clasifica incidencias por prioridad, añade responsables y haz seguimiento de su resolución.',
    badge: 'Work in progress',
  },
  {
    title: 'Asignaciones',
    description: 'Pronto podrás asignar tareas a miembros del equipo y notificar cambios de estado al instante.',
  },
  {
    title: 'Adjuntos y fotos',
    description: 'Espacio reservado para documentación de las incidencias con fotos y comentarios del personal.',
  },
];

const quickNotes = {
  items: [
    'Registrar fuga de agua en lavabo de clientes - revisar juntas.',
    'Actualizar checklist de incidencias críticas para el cierre.',
    'Añadir repuesto de bombillas GU10 al pedido semanal.',
  ],
};

export default async function MantenimientoTareasPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent('/mantenimiento/tareas')}`);
  }

  return (
    <ModulePlaceholder
      title="Tareas e incidencias"
      subtitle="Organiza incidencias, tareas recurrentes y responsables para mantener el servicio en marcha."
      cards={cards}
      quickNotes={quickNotes}
    />
  );
}

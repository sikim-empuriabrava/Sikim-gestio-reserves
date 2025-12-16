import { redirect } from 'next/navigation';
import { ModulePlaceholder } from '@/components/ModulePlaceholder';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const cards = [
  {
    title: 'Dashboard operativo',
    description: 'Resumen diario de incidencias, prioridades y validaciones pendientes para el equipo de mantenimiento.',
    badge: 'En diseño',
  },
  {
    title: 'Checklist de turnos',
    description: 'Listados de apertura y cierre con responsables, tiempos estimados y seguimiento de cumplimiento.',
  },
  {
    title: 'Histórico de tareas',
    description: 'Pronto podrás revisar qué se resolvió cada día y cómo afectó al servicio o inventario.',
  },
];

const quickNotes = {
  items: [
    'Pendiente confirmar repuestos de iluminación en terraza.',
    'Registrar incidencias de la máquina de hielo antes del fin de semana.',
    'Dejar anotada la limpieza profunda de almacén para el lunes.',
  ],
};

export default async function MantenimientoPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent('/mantenimiento')}`);
  }

  return (
    <ModulePlaceholder
      title="Mantenimiento"
      subtitle="Control centralizado de incidencias, validaciones y rutinas de mantenimiento preventivo."
      cards={cards}
      quickNotes={quickNotes}
    />
  );
}

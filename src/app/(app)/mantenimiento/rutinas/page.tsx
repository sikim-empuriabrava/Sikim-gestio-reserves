import { redirect } from 'next/navigation';
import { ModulePlaceholder } from '@/components/ModulePlaceholder';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const cards = [
  {
    title: 'Rutinas semanales',
    description: 'Define tareas preventivas por día y franja horaria para evitar incidencias durante el servicio.',
  },
  {
    title: 'Turnos y responsables',
    description: 'Planea qué equipo asume cada rutina y registra verificaciones rápidas desde el móvil.',
  },
  {
    title: 'Checklist recurrentes',
    description: 'Plantillas reutilizables para limpieza, revisiones eléctricas y chequeos de seguridad.',
    badge: 'Plantillas',
  },
];

const quickNotes = {
  items: [
    'Incluir revisión de extintores y salidas de emergencia cada miércoles.',
    'Recordar limpieza de filtros de campana los jueves por la mañana.',
    'Planificar engrase de bisagras y cerraduras cada dos semanas.',
  ],
};

export default async function MantenimientoRutinasPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent('/mantenimiento/rutinas')}`);
  }

  return (
    <ModulePlaceholder
      title="Rutinas semanales"
      subtitle="Planifica las tareas preventivas para que cada turno llegue con todo el material listo."
      cards={cards}
      quickNotes={quickNotes}
    />
  );
}

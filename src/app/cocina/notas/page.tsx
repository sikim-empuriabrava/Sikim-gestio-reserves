import { redirect } from 'next/navigation';
import { ModulePlaceholder } from '@/components/ModulePlaceholder';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const cards = [
  {
    title: 'Notas de cocina',
    description: 'Centraliza instrucciones del chef, preparaciones especiales y avisos para el pase.',
  },
  {
    title: 'Histórico de cambios',
    description: 'Visualiza ajustes recientes en recetas o técnicas y marca qué turnos ya han sido informados.',
    badge: 'Historial',
  },
  {
    title: 'Compartir con sala',
    description: 'Pronto podrás enviar avisos a sala sobre alérgenos, faltas de stock o tiempos estimados.',
  },
];

const quickNotes = {
  items: [
    'Avisar que el coulis de frutos rojos se reemplaza por mango hasta nuevo aviso.',
    'Registrar variaciones en el punto de cocción de la carrillera para eventos.',
    'Incluir nueva guarnición de temporada en el pase de hoy.',
  ],
};

export default async function CocinaNotasPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent('/cocina/notas')}`);
  }

  return (
    <ModulePlaceholder
      title="Notas de cocina"
      subtitle="Anota instrucciones clave para el pase y comparte cambios con el resto del equipo."
      cards={cards}
      quickNotes={quickNotes}
    />
  );
}

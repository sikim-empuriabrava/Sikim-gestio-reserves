import { redirect } from 'next/navigation';
import { ModulePlaceholder } from '@/components/ModulePlaceholder';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const cards = [
  {
    title: 'Servicio de hoy',
    description: 'Vista rápida de menús, reservas y necesidades especiales para coordinar la partida de cocina.',
    badge: 'Diario',
  },
  {
    title: 'Pases y tiempos',
    description: 'Configuración futura para marcar tiempos de pase y comunicación con sala en tiempo real.',
  },
  {
    title: 'Cobertura de equipos',
    description: 'Plan de quién lidera cada partida y qué refuerzos se necesitan para el servicio.',
  },
];

const quickNotes = {
  items: [
    'Confirmar menús sin gluten y alérgenos antes del primer pase.',
    'Revisar mise en place de postres y registrar faltas en cámara.',
    'Coordinación con sala para los grupos de las 22:00.',
  ],
};

export default async function CocinaPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent('/cocina')}`);
  }

  return (
    <ModulePlaceholder
      title="Cocina"
      subtitle="Panel de apoyo al servicio diario con notas rápidas, menús y avisos de alérgenos."
      cards={cards}
      quickNotes={quickNotes}
    />
  );
}

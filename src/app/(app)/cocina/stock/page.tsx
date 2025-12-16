import { redirect } from 'next/navigation';
import { ModulePlaceholder } from '@/components/ModulePlaceholder';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const cards = [
  {
    title: 'Stock y mise en place',
    description: 'Control de materia prima clave, mise en place y previsiones de consumo por servicio.',
    badge: 'Próximamente',
  },
  {
    title: 'Reposición rápida',
    description: 'Solicitudes express a almacén con cantidades sugeridas según reservas previstas.',
  },
  {
    title: 'Alertas de faltas',
    description: 'Avisos automáticos cuando se detecten bajas existencias o productos críticos.',
  },
];

const quickNotes = {
  items: [
    'Comprobar stock de pasta fresca y raciones de tartar para el sábado.',
    'Añadir cítricos y hierbas frescas al pedido de la mañana.',
    'Revisar nivel de fondos y salsas base para el doble turno.',
  ],
};

export default async function CocinaStockPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent('/cocina/stock')}`);
  }

  return (
    <ModulePlaceholder
      title="Stock / mise en place"
      subtitle="Planea reposiciones y mise en place para cada servicio sin perder control de los básicos."
      cards={cards}
      quickNotes={quickNotes}
    />
  );
}

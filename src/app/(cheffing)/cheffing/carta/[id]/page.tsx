import Link from 'next/link';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireCheffingAccess } from '@/lib/cheffing/requireCheffing';
import { loadCheffingConsumerDishes } from '@/lib/cheffing/consumerQueries';
import type { CheffingCard, CheffingCardItem } from '@/lib/cheffing/types';

import { CheffingConsumerEditor } from '@/app/(cheffing)/cheffing/components/CheffingConsumerEditor';

export default async function CheffingCartaDetailPage({ params }: { params: { id: string } }) {
  await requireCheffingAccess();

  const supabase = createSupabaseServerClient();
  const [{ data: card }, { data: items }, { dishes }] = await Promise.all([
    supabase
      .from('cheffing_cards')
      .select('id, name, notes, is_active, created_at, updated_at')
      .eq('id', params.id)
      .maybeSingle(),
    supabase
      .from('cheffing_card_items')
      .select('id, card_id, dish_id, multiplier, sort_order, notes, created_at, updated_at')
      .eq('card_id', params.id)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
    loadCheffingConsumerDishes(),
  ]);

  if (!card) {
    return (
      <section className="space-y-4 rounded-2xl border border-slate-800/80 bg-slate-900/70 p-6">
        <p className="text-sm text-slate-300">No se encontró la carta.</p>
        <Link href="/cheffing/carta" className="text-sm text-emerald-300 underline">
          Volver al listado
        </Link>
      </section>
    );
  }

  const typedCard = card as CheffingCard;

  return (
    <section className="space-y-6 rounded-2xl border border-slate-800/80 bg-slate-900/70 p-6">
      <header className="space-y-2">
        <h2 className="text-xl font-semibold text-white">Carta · {typedCard.name}</h2>
        <p className="text-sm text-slate-400">Edita cabecera y líneas consumidoras.</p>
      </header>

      <CheffingConsumerEditor
        mode="card"
        id={typedCard.id}
        header={{
          name: typedCard.name,
          notes: typedCard.notes ?? '',
          is_active: typedCard.is_active,
        }}
        items={(items ?? []) as CheffingCardItem[]}
        dishes={dishes}
      />
    </section>
  );
}

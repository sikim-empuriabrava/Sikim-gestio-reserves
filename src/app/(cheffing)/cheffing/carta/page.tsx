import Link from 'next/link';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireCheffingAccess } from '@/lib/cheffing/requireCheffing';

export default async function CheffingCartaPage() {
  await requireCheffingAccess();

  const supabase = createSupabaseServerClient();
  const [{ data: cards, error: cardsError }, { data: items, error: itemsError }] = await Promise.all([
    supabase
      .from('cheffing_cards')
      .select('id, name, notes, is_active, created_at, updated_at')
      .order('name', { ascending: true }),
    supabase.from('cheffing_card_items').select('id, card_id'),
  ]);

  if (cardsError || itemsError) {
    console.error('[cheffing/carta] Failed to load cards', cardsError ?? itemsError);
  }

  const countByCardId = new Map<string, number>();
  (items ?? []).forEach((item) => {
    countByCardId.set(item.card_id, (countByCardId.get(item.card_id) ?? 0) + 1);
  });

  return (
    <section className="space-y-6 rounded-2xl border border-slate-800/80 bg-slate-900/70 p-6">
      <header className="space-y-2">
        <h2 className="text-xl font-semibold text-white">Carta</h2>
        <p className="text-sm text-slate-400">Gestor de colección comercial de platos y bebidas.</p>
      </header>

      <div className="flex items-center justify-end">
        <Link
          href="/cheffing/carta/new"
          className="rounded-full border border-emerald-400/60 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-200 transition hover:border-emerald-300 hover:text-emerald-100"
        >
          Nueva carta
        </Link>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-800/70">
        <table className="w-full min-w-[760px] text-left text-sm text-slate-200">
          <thead className="bg-slate-950/70 text-xs uppercase text-slate-400">
            <tr>
              <th className="px-4 py-3">Carta</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Items asociados</th>
              <th className="px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {(cards ?? []).length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                  No hay cartas.
                </td>
              </tr>
            ) : (
              (cards ?? []).map((card) => (
                <tr key={card.id} className="border-t border-slate-800/60">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-white">{card.name}</p>
                    {card.notes ? <p className="text-xs text-slate-500">{card.notes}</p> : null}
                  </td>
                  <td className="px-4 py-3">{card.is_active ? 'Activa' : 'Inactiva'}</td>
                  <td className="px-4 py-3">{countByCardId.get(card.id) ?? 0}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/cheffing/carta/${card.id}`}
                      className="rounded-full border border-slate-600 px-3 py-1 text-xs font-semibold text-slate-200 transition hover:border-slate-400"
                    >
                      Ver detalle
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

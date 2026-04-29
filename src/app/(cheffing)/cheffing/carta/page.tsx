import Link from 'next/link';
import { EyeIcon, PlusIcon } from '@heroicons/react/24/outline';

import { DataTableShell, PageHeader, StatusBadge, cn } from '@/components/ui';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireCheffingAccess } from '@/lib/cheffing/requireCheffing';
import {
  CheffingEmptyState,
  CheffingLinkButton,
  CheffingTableActionLink,
  cheffingNumericClassName,
  cheffingRowClassName,
  cheffingTableClassName,
  cheffingTheadClassName,
} from '@/app/(cheffing)/cheffing/components/CheffingUi';

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
    <>
      <PageHeader
        eyebrow="Cheffing"
        title="Carta"
        description="Gestor de colección comercial de platos y bebidas."
        actions={
          <CheffingLinkButton href="/cheffing/carta/new" tone="success">
            <PlusIcon className="h-4 w-4" aria-hidden="true" />
            Nueva carta
          </CheffingLinkButton>
        }
      />

      <DataTableShell
        title="Listado de cartas"
        description="Estado e items asociados a cada carta comercial."
        footer={`${(cards ?? []).length} cartas`}
      >
        <table className={cn(cheffingTableClassName, 'min-w-[760px]')}>
          <thead className={cheffingTheadClassName}>
            <tr className="border-b border-slate-800/80">
              <th className="w-[40%] px-4 py-3 font-semibold text-slate-300">Carta</th>
              <th className="px-4 py-3 font-semibold text-slate-300">Estado</th>
              <th className="px-4 py-3 font-semibold text-slate-300">Items asociados</th>
              <th className="px-4 py-3 text-right font-semibold text-slate-300">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 bg-slate-950/20">
            {(cards ?? []).length === 0 ? (
              <CheffingEmptyState colSpan={4} title="No hay cartas." description="Crea una carta para agrupar platos y bebidas." />
            ) : (
              (cards ?? []).map((card) => (
                <tr key={card.id} className={cheffingRowClassName}>
                  <td className="px-4 py-3 align-middle">
                    <Link
                      href={`/cheffing/carta/${card.id}`}
                      className="font-semibold text-white underline-offset-4 transition hover:text-primary-100 hover:underline"
                    >
                      {card.name}
                    </Link>
                    {card.notes ? <p className="mt-1 text-xs text-slate-500">{card.notes}</p> : null}
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <StatusBadge tone={card.is_active ? 'success' : 'muted'}>
                      {card.is_active ? 'Activa' : 'Inactiva'}
                    </StatusBadge>
                  </td>
                  <td className={cn('px-4 py-3 align-middle', cheffingNumericClassName)}>
                    {countByCardId.get(card.id) ?? 0}
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <div className="flex justify-end">
                      <CheffingTableActionLink href={`/cheffing/carta/${card.id}`}>
                        <EyeIcon className="h-4 w-4" aria-hidden="true" />
                        Ver detalle
                      </CheffingTableActionLink>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </DataTableShell>
    </>
  );
}

import { requireCheffingAccess } from '@/lib/cheffing/requireCheffing';
import { loadCheffingConsumerDishes } from '@/lib/cheffing/consumerQueries';

import { CheffingCardEditor, cardHeaderDefaults } from '@/app/(cheffing)/cheffing/components/CheffingCardEditor';

export default async function CheffingCartaNewPage() {
  await requireCheffingAccess();

  const { dishes } = await loadCheffingConsumerDishes();

  return (
    <section className="space-y-6 rounded-2xl border border-slate-800/80 bg-slate-900/70 p-6">
      <header className="space-y-2">
        <h2 className="text-xl font-semibold text-white">Nueva carta</h2>
        <p className="text-sm text-slate-400">Primero guarda cabecera y luego asocia platos y bebidas.</p>
      </header>

      <CheffingCardEditor id={null} header={cardHeaderDefaults} items={[]} dishes={dishes} />
    </section>
  );
}

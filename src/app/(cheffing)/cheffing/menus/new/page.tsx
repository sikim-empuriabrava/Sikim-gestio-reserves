import { PageHeader } from '@/components/ui';
import { requireCheffingAccess } from '@/lib/cheffing/requireCheffing';
import { loadCheffingConsumerDishes } from '@/lib/cheffing/consumerQueries';

import { CheffingMenuEditor, menuHeaderDefaults } from '@/app/(cheffing)/cheffing/components/CheffingMenuEditor';

export default async function CheffingMenusNewPage() {
  await requireCheffingAccess();

  const { dishes } = await loadCheffingConsumerDishes();

  return (
    <>
      <PageHeader
        eyebrow="Cheffing"
        title="Nuevo menú"
        description="Guarda cabecera y después añade líneas por sección."
      />

      <CheffingMenuEditor id={null} header={menuHeaderDefaults} items={[]} dishes={dishes} />
    </>
  );
}

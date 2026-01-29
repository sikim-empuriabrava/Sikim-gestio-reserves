import { requireCheffingAccess } from '@/lib/cheffing/requireCheffing';
import { redirect } from 'next/navigation';

export default async function CheffingIngredientesNewPage() {
  await requireCheffingAccess();
  redirect('/cheffing/productos/new');
}

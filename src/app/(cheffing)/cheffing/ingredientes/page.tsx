import { requireCheffingAccess } from '@/lib/cheffing/requireCheffing';
import { redirect } from 'next/navigation';

export default async function CheffingIngredientesPage() {
  await requireCheffingAccess();
  redirect('/cheffing/productos');
}

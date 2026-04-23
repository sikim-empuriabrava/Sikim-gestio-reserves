import { redirect } from 'next/navigation';

export default async function CheffingIngredienteDetailAliasPage({ params }: { params: { id: string } }) {
  redirect(`/cheffing/productos/${encodeURIComponent(params.id)}`);
}

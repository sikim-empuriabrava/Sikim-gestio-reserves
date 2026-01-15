import { redirect } from 'next/navigation';

type PageSearchParams = {
  week_start?: string;
};

export default async function MantenimientoRutinasPage({ searchParams }: { searchParams: PageSearchParams }) {
  const params = new URLSearchParams();

  if (searchParams.week_start) {
    params.set('week_start', searchParams.week_start);
  }

  const query = params.toString();
  redirect(query ? `/admin/rutinas?${query}` : '/admin/rutinas');
}

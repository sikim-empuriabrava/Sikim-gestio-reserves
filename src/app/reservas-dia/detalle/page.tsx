import { redirect } from 'next/navigation';

type ReservasDiaDetallePageProps = { searchParams?: { date?: string } };

export default function ReservasDiaDetalleRedirect({ searchParams }: ReservasDiaDetallePageProps) {
  const targetDate = searchParams?.date;
  const query = targetDate ? `?view=day&date=${targetDate}` : '?view=day';
  redirect(`/reservas${query}`);
}

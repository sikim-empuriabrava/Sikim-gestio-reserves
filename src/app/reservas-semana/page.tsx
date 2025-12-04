import { redirect } from 'next/navigation';

export default function ReservasSemanaRedirectPage() {
  redirect('/reservas?view=week');
}

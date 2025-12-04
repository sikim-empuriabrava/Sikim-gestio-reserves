import { redirect } from 'next/navigation';

export default function ReservasDiaRedirect() {
  redirect('/reservas?view=week');
}

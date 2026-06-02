import { OperationalPageHeader } from '@/components/operational/OperationalUI';
import { PushNotificationsManager } from './PushNotificationsManager';

export const dynamic = 'force-dynamic';

export default function AdminNotificationsPage() {
  return (
    <>
      <OperationalPageHeader
        eyebrow="Admin"
        title="Notificaciones"
        description="Activa este dispositivo para recibir avisos internos de nuevas solicitudes externas de reserva."
      />

      <PushNotificationsManager />
    </>
  );
}

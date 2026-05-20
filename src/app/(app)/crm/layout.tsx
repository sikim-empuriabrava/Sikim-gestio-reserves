import { requireCrmReadAccess } from '@/lib/crm/access';

export default async function CrmLayout({ children }: { children: React.ReactNode }) {
  await requireCrmReadAccess('/crm');

  return <div className="crm-warm-page space-y-6">{children}</div>;
}

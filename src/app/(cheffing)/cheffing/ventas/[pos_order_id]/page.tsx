import Link from 'next/link';
import { notFound } from 'next/navigation';

import { requireCheffingAccess } from '@/lib/cheffing/requireCheffing';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const currencyFormatter = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });

export default async function CheffingVentaDetallePage({ params }: { params: { pos_order_id: string } }) {
  await requireCheffingAccess();

  const supabase = createSupabaseServerClient();
  const posOrderId = decodeURIComponent(params.pos_order_id);

  const [{ data: order }, { data: lines }] = await Promise.all([
    supabase.from('cheffing_pos_orders').select('*').eq('pos_order_id', posOrderId).maybeSingle(),
    supabase
      .from('cheffing_pos_order_items')
      .select('*')
      .eq('pos_order_id', posOrderId)
      .order('opened_at', { ascending: true })
      .order('product_name', { ascending: true }),
  ]);

  if (!order) {
    notFound();
  }

  return (
    <section className="space-y-6 rounded-2xl border border-slate-800/80 bg-slate-900/70 p-6">
      <Link href="/cheffing/ventas" className="text-sm text-emerald-300">
        ← Volver a Ventas
      </Link>
      <header className="space-y-1">
        <h2 className="text-xl font-semibold text-white">Pedido {order.pos_order_id}</h2>
        <p className="text-sm text-slate-300">
          {new Date(order.opened_at).toLocaleString('es-ES')} · Outlet {order.outlet_id}
        </p>
      </header>

      <div className="grid gap-3 rounded-xl border border-slate-800 p-4 text-sm text-slate-200 md:grid-cols-3">
        <p>Clientes: {order.clients ?? '—'}</p>
        <p>Total bruto: {order.total_gross === null ? '—' : currencyFormatter.format(order.total_gross)}</p>
        <p>Estado: {order.status ?? '—'}</p>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-800">
        <table className="min-w-full text-left text-sm text-slate-200">
          <thead className="bg-slate-950/70 text-xs uppercase text-slate-400">
            <tr>
              <th className="px-3 py-2">Producto</th>
              <th className="px-3 py-2">Cantidad</th>
              <th className="px-3 py-2">P. unitario bruto</th>
              <th className="px-3 py-2">Descuento</th>
              <th className="px-3 py-2">Total bruto</th>
            </tr>
          </thead>
          <tbody>
            {(lines ?? []).map((line) => (
              <tr key={line.id} className="border-t border-slate-800">
                <td className="px-3 py-2">{line.product_name}</td>
                <td className="px-3 py-2">{line.quantity}</td>
                <td className="px-3 py-2">{currencyFormatter.format(Number(line.unit_price_gross ?? 0))}</td>
                <td className="px-3 py-2">{currencyFormatter.format(Number(line.discount_gross ?? 0))}</td>
                <td className="px-3 py-2">{currencyFormatter.format(Number(line.total_gross ?? 0))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

export type ReservasDiaDatePickerProps = {
  selectedDate: string;
};

export function ReservasDiaDatePicker({ selectedDate }: ReservasDiaDatePickerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextDate = event.target.value;
    if (!nextDate) return;

    startTransition(() => {
      router.push(`/reservas-dia?date=${nextDate}`);
    });
  };

  return (
    <div className="flex items-center gap-3">
      <label className="text-sm text-slate-300" htmlFor="reservas-dia-date">
        Fecha:
      </label>
      <input
        id="reservas-dia-date"
        type="date"
        className="rounded-md border border-slate-600 bg-slate-900 px-3 py-1 text-sm text-slate-100 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
        value={selectedDate}
        onChange={handleChange}
        disabled={isPending}
      />
    </div>
  );
}

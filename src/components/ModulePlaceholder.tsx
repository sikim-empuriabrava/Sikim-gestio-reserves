type PlaceholderCard = {
  title: string;
  description: string;
  badge?: string;
};

type QuickNotes = {
  title?: string;
  items: string[];
};

type ModulePlaceholderProps = {
  title: string;
  subtitle: string;
  cards: PlaceholderCard[];
  quickNotes?: QuickNotes;
};

export function ModulePlaceholder({ title, subtitle, cards, quickNotes }: ModulePlaceholderProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm uppercase tracking-wide text-primary-200">Próximamente</p>
        <h1 className="text-2xl font-bold text-white">{title}</h1>
        <p className="text-sm text-slate-400">{subtitle}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <div key={card.title} className="card space-y-3 p-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-white">{card.title}</h3>
              {card.badge && (
                <span className="badge bg-primary-500/15 text-primary-100 ring-1 ring-primary-500/30">{card.badge}</span>
              )}
            </div>
            <p className="text-sm text-slate-400">{card.description}</p>
          </div>
        ))}
      </div>

      {quickNotes && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="card lg:col-span-2 p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">{quickNotes.title ?? 'Notas rápidas'}</h2>
              <span className="badge bg-slate-800 text-slate-200">Borrador</span>
            </div>
            <ul className="mt-3 space-y-2 text-sm text-slate-300">
              {quickNotes.items.map((item, index) => (
                <li key={index} className="flex gap-2 rounded-lg bg-slate-900/50 px-3 py-2 ring-1 ring-slate-800">
                  <span className="text-primary-200">•</span>
                  <span className="text-slate-200">{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="card p-5">
            <h3 className="text-base font-semibold text-white">Acciones rápidas</h3>
            <p className="mt-2 text-sm text-slate-400">
              Añade recordatorios breves para el equipo. Este espacio se conectará con datos reales en la siguiente
              iteración.
            </p>
            <div className="mt-3 space-y-2 text-sm text-slate-300">
              <p className="rounded-lg bg-primary-600/10 px-3 py-2 text-primary-100 ring-1 ring-primary-500/30">
                ✓ Marca tareas críticas como atendidas.
              </p>
              <p className="rounded-lg bg-slate-900/60 px-3 py-2 ring-1 ring-slate-800">
                ✎ Comparte notas operativas con otros turnos.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

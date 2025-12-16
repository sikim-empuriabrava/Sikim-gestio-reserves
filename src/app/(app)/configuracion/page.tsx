import { Cog6ToothIcon, ShieldCheckIcon, WifiIcon } from '@heroicons/react/24/outline';

const ajustes = [
  {
    title: 'Integraciones',
    description: 'Pronto podrás conectar Supabase y otros proveedores para sincronizar datos.',
    icon: WifiIcon,
  },
  {
    title: 'Roles y permisos',
    description: 'Configuración futura para equipos de sala y cocina.',
    icon: ShieldCheckIcon,
  },
  {
    title: 'Preferencias del local',
    description: 'Turnos, horarios, mensajes automatizados y branding.',
    icon: Cog6ToothIcon,
  },
];

export default function ConfiguracionPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <p className="text-sm uppercase tracking-wide text-primary-200">Próximamente</p>
        <h1 className="section-title text-2xl">Configuración</h1>
        <p className="text-sm text-slate-400">
          Pantalla reservada para ajustes generales y sincronización con base de datos.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {ajustes.map((item) => (
          <div key={item.title} className="card space-y-3 p-5">
            <item.icon className="h-6 w-6 text-primary-300" />
            <div>
              <h3 className="text-lg font-semibold text-white">{item.title}</h3>
              <p className="text-sm text-slate-400">{item.description}</p>
            </div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Modo placeholder</p>
          </div>
        ))}
      </div>
    </div>
  );
}

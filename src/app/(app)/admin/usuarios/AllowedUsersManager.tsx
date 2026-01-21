'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

type Role = 'admin' | 'staff' | 'viewer';
type AllowedUser = {
  id: string;
  email: string;
  display_name: string | null;
  role: Role;
  is_active: boolean;
  can_reservas: boolean;
  can_mantenimiento: boolean;
  can_cocina: boolean;
  can_cheffing: boolean;
};

type FormState = {
  email: string;
  display_name: string;
  role: Role;
  is_active: boolean;
  can_reservas: boolean;
  can_mantenimiento: boolean;
  can_cocina: boolean;
  can_cheffing: boolean;
};

const roleLabels: Record<Role, string> = {
  admin: 'Admin',
  staff: 'Staff',
  viewer: 'Viewer',
};

const defaultForm: FormState = {
  email: '',
  display_name: '',
  role: 'viewer',
  is_active: true,
  can_reservas: false,
  can_mantenimiento: false,
  can_cocina: false,
  can_cheffing: false,
};

type Props = {
  initialUsers: AllowedUser[];
  initialLoadError?: string | null;
  currentUserEmail: string;
  currentUserRole: string | null;
};

export function AllowedUsersManager({
  initialUsers,
  initialLoadError,
  currentUserEmail,
  currentUserRole,
}: Props) {
  const [users, setUsers] = useState<AllowedUser[]>(initialUsers);
  const [form, setForm] = useState<FormState>(defaultForm);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/allowed-users', { cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || 'No se pudieron cargar los usuarios');
      }

      setUsers(payload?.rows ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialUsers.length === 0 && users.length === 0) {
      loadUsers();
    }
  }, [initialUsers.length, loadUsers, users.length]);

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreating(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch('/api/admin/allowed-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || 'No se pudo crear el usuario');
      }

      setUsers((prev) => [...prev, payload].sort((a, b) => a.email.localeCompare(b.email)));
      setForm(defaultForm);
      setMessage('Usuario creado correctamente.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el usuario');
    } finally {
      setCreating(false);
    }
  };

  const handleUpdate = async (id: string, updates: Partial<AllowedUser>) => {
    setSavingId(id);
    setError(null);
    setMessage(null);

    const previous = users;
    setUsers((prev) => prev.map((user) => (user.id === id ? { ...user, ...updates } : user)));

    try {
      const response = await fetch(`/api/admin/allowed-users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || 'No se pudo actualizar el usuario');
      }

      setUsers((prev) => prev.map((user) => (user.id === id ? payload : user)));
      setMessage('Cambios guardados.');
    } catch (err) {
      setUsers(previous);
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el usuario');
    } finally {
      setSavingId(null);
    }
  };

  const counts = useMemo(() => {
    const active = users.filter((user) => user.is_active).length;
    return { total: users.length, active };
  }, [users]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Usuarios y permisos</h1>
          <p className="text-sm text-slate-400">
            Activa usuarios y controla el acceso a Reservas, Mantenimiento, Cocina y Cheffing.
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm text-slate-300">
          <span className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1">
            {counts.active} activos
          </span>
          <span className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1">
            {counts.total} en total
          </span>
          <button
            type="button"
            onClick={loadUsers}
            disabled={loading}
            className="rounded-md border border-slate-700 bg-slate-900/70 px-3 py-1 text-sm font-semibold text-slate-200 transition hover:border-slate-500 disabled:opacity-60"
          >
            {loading ? 'Actualizando...' : 'Refrescar'}
          </button>
        </div>
      </div>

      {initialLoadError && (
        <div className="rounded-2xl border border-amber-900/60 bg-amber-950/40 p-4 text-sm text-amber-100">
          No se pudo precargar la lista de usuarios en el servidor. La app intentará cargarlos
          desde el navegador. Detalle: {initialLoadError}
        </div>
      )}

      <div className="rounded-2xl border border-emerald-900/60 bg-emerald-950/40 p-4 text-sm text-emerald-100">
        <p className="font-semibold">Debug allowlist</p>
        <div className="mt-2 grid gap-2 text-xs text-emerald-200/90 sm:grid-cols-3">
          <div>
            <span className="uppercase tracking-wide text-emerald-300/80">Logged as</span>
            <div className="font-semibold">{currentUserEmail}</div>
          </div>
          <div>
            <span className="uppercase tracking-wide text-emerald-300/80">Role</span>
            <div className="font-semibold">{currentUserRole ?? '—'}</div>
          </div>
          <div>
            <span className="uppercase tracking-wide text-emerald-300/80">Rows</span>
            <div className="font-semibold">{counts.total}</div>
          </div>
        </div>
      </div>

      <form
        onSubmit={handleCreate}
        className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-5"
      >
        <div className="flex items-center justify-between">
          <p className="text-lg font-semibold text-white">Nuevo usuario allowlisted</p>
          <span className="text-xs uppercase tracking-wide text-slate-400">Admin</span>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm text-slate-200">
            <span className="block font-semibold">Email</span>
            <input
              required
              type="email"
              value={form.email}
              onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
              className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white focus:border-slate-500 focus:outline-none"
              placeholder="usuario@empresa.com"
            />
          </label>

          <label className="space-y-2 text-sm text-slate-200">
            <span className="block font-semibold">Nombre visible (opcional)</span>
            <input
              type="text"
              value={form.display_name}
              onChange={(event) => setForm((prev) => ({ ...prev, display_name: event.target.value }))}
              className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white focus:border-slate-500 focus:outline-none"
              placeholder="Nombre del equipo"
            />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <label className="space-y-2 text-sm text-slate-200">
            <span className="block font-semibold">Rol</span>
            <select
              value={form.role}
              onChange={(event) => setForm((prev) => ({ ...prev, role: event.target.value as Role }))}
              className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white"
            >
              {Object.keys(roleLabels).map((role) => (
                <option key={role} value={role}>
                  {roleLabels[role as Role]}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(event) => setForm((prev) => ({ ...prev, is_active: event.target.checked }))}
              className="h-4 w-4 accent-emerald-500"
            />
            <span className="font-semibold">Usuario activo</span>
          </label>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold text-slate-200">Permisos por módulo</p>
          <div className="grid gap-3 md:grid-cols-4">
            <label className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={form.can_reservas}
                onChange={(event) => setForm((prev) => ({ ...prev, can_reservas: event.target.checked }))}
                className="h-4 w-4 accent-emerald-500"
              />
              <span>Reservas</span>
            </label>
            <label className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={form.can_mantenimiento}
                onChange={(event) => setForm((prev) => ({ ...prev, can_mantenimiento: event.target.checked }))}
                className="h-4 w-4 accent-emerald-500"
              />
              <span>Mantenimiento</span>
            </label>
            <label className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={form.can_cocina}
                onChange={(event) => setForm((prev) => ({ ...prev, can_cocina: event.target.checked }))}
                className="h-4 w-4 accent-emerald-500"
              />
              <span>Cocina</span>
            </label>
            <label className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={form.can_cheffing}
                onChange={(event) => setForm((prev) => ({ ...prev, can_cheffing: event.target.checked }))}
                className="h-4 w-4 accent-emerald-500"
              />
              <span>Cheffing</span>
            </label>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={creating || !form.email.trim()}
            className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {creating ? 'Guardando...' : 'Crear usuario'}
          </button>
          <button
            type="button"
            onClick={() => setForm(defaultForm)}
            className="rounded-md border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500"
          >
            Limpiar
          </button>
          {error && <span className="text-sm text-amber-200">{error}</span>}
          {message && <span className="text-sm text-emerald-300">{message}</span>}
        </div>
      </form>

      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <p className="text-sm font-semibold text-slate-200">Usuarios allowlisted</p>
          {savingId && <span className="text-xs text-slate-400">Guardando cambios...</span>}
        </div>
        {error && (
          <div className="border-b border-slate-800 px-4 py-2 text-xs text-amber-200">
            {error}
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-800 text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Rol</th>
                <th className="px-4 py-3">Activo</th>
                <th className="px-4 py-3">Reservas</th>
                <th className="px-4 py-3">Mantenimiento</th>
                <th className="px-4 py-3">Cocina</th>
                <th className="px-4 py-3">Cheffing</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {users.map((user) => (
                <tr key={user.id} className="text-slate-100">
                  <td className="px-4 py-3 text-sm font-semibold text-slate-100">
                    <input
                      value={user.email}
                      onChange={(event) =>
                        setUsers((prev) =>
                          prev.map((item) =>
                            item.id === user.id ? { ...item, email: event.target.value } : item
                          )
                        )
                      }
                      onBlur={(event) => handleUpdate(user.id, { email: event.target.value })}
                      className="w-full rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-sm text-white focus:border-slate-500 focus:outline-none"
                      placeholder="email@empresa.com"
                      disabled={savingId === user.id}
                    />
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-300">
                    <input
                      value={user.display_name ?? ''}
                      onChange={(event) =>
                        setUsers((prev) =>
                          prev.map((item) =>
                            item.id === user.id ? { ...item, display_name: event.target.value } : item
                          )
                        )
                      }
                      onBlur={(event) => handleUpdate(user.id, { display_name: event.target.value })}
                      className="w-full rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-sm text-white focus:border-slate-500 focus:outline-none"
                      placeholder="—"
                      disabled={savingId === user.id}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={user.role}
                      onChange={(event) => handleUpdate(user.id, { role: event.target.value as Role })}
                      className="rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-sm text-white"
                      disabled={savingId === user.id}
                    >
                      {Object.keys(roleLabels).map((role) => (
                        <option key={role} value={role}>
                          {roleLabels[role as Role]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={user.is_active}
                      onChange={(event) => handleUpdate(user.id, { is_active: event.target.checked })}
                      className="h-4 w-4 accent-emerald-500"
                      disabled={savingId === user.id}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={user.can_reservas}
                      onChange={(event) => handleUpdate(user.id, { can_reservas: event.target.checked })}
                      className="h-4 w-4 accent-emerald-500"
                      disabled={savingId === user.id}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={user.can_mantenimiento}
                      onChange={(event) => handleUpdate(user.id, { can_mantenimiento: event.target.checked })}
                      className="h-4 w-4 accent-emerald-500"
                      disabled={savingId === user.id}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={user.can_cocina}
                      onChange={(event) => handleUpdate(user.id, { can_cocina: event.target.checked })}
                      className="h-4 w-4 accent-emerald-500"
                      disabled={savingId === user.id}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={user.can_cheffing}
                      onChange={(event) => handleUpdate(user.id, { can_cheffing: event.target.checked })}
                      className="h-4 w-4 accent-emerald-500"
                      disabled={savingId === user.id}
                    />
                  </td>
                </tr>
              ))}
              {users.length === 0 && loading && (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-sm text-slate-400">
                    Cargando usuarios...
                  </td>
                </tr>
              )}
              {users.length === 0 && !loading && (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-sm text-slate-400">
                    No hay usuarios allowlisted todavía.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

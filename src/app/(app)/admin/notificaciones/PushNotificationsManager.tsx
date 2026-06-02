'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { BellAlertIcon, DevicePhoneMobileIcon } from '@heroicons/react/24/outline';
import {
  OperationalPanel,
  OperationalPill,
  OperationalSectionHeader,
  operationalPrimaryButtonClass,
  operationalSecondaryButtonClass,
} from '@/components/operational/OperationalUI';

const PUSH_SERVICE_WORKER_URL = '/aforo-sw.js';

type PushStatusResponse = {
  ok?: boolean;
  canReceiveNotifications?: boolean;
  vapidPublicKeyConfigured?: boolean;
  vapidPublicKey?: string | null;
  deviceActive?: boolean | null;
  error?: string;
};

type BrowserSupport = {
  checked: boolean;
  supported: boolean;
};

function isPushSupported() {
  return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
}

async function getPushRegistration() {
  const registration = await navigator.serviceWorker.register(PUSH_SERVICE_WORKER_URL, {
    scope: '/',
  });

  return navigator.serviceWorker.ready.then(() => registration);
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = `${base64String}${padding}`.replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index);
  }

  return outputArray;
}

function getDeviceLabel() {
  const platform = navigator.platform?.trim();
  return platform ? `Dispositivo actual (${platform})` : 'Dispositivo actual';
}

async function fetchPushStatus(endpoint?: string) {
  const url = endpoint
    ? `/api/notifications/push-subscription?endpoint=${encodeURIComponent(endpoint)}`
    : '/api/notifications/push-subscription';
  const response = await fetch(url, { cache: 'no-store' });
  const payload = (await response.json().catch(() => ({}))) as PushStatusResponse;

  if (!response.ok) {
    throw new Error(payload.error || 'No se pudo cargar el estado de notificaciones.');
  }

  return payload;
}

export function PushNotificationsManager() {
  const [support, setSupport] = useState<BrowserSupport>({ checked: false, supported: false });
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [canReceiveNotifications, setCanReceiveNotifications] = useState(false);
  const [vapidPublicKey, setVapidPublicKey] = useState<string | null>(null);
  const [vapidPublicKeyConfigured, setVapidPublicKeyConfigured] = useState(false);
  const [deviceActive, setDeviceActive] = useState(false);
  const [browserEndpoint, setBrowserEndpoint] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const supported = isPushSupported();
      setSupport({ checked: true, supported });

      if ('Notification' in window) {
        setPermission(Notification.permission);
      }

      const baseStatus = await fetchPushStatus();
      setCanReceiveNotifications(Boolean(baseStatus.canReceiveNotifications));
      setVapidPublicKeyConfigured(Boolean(baseStatus.vapidPublicKeyConfigured));
      setVapidPublicKey(baseStatus.vapidPublicKey ?? null);

      if (!supported) {
        setDeviceActive(false);
        setBrowserEndpoint(null);
        return;
      }

      const registration = await getPushRegistration();
      const subscription = await registration.pushManager.getSubscription();

      if (!subscription?.endpoint) {
        setDeviceActive(false);
        setBrowserEndpoint(null);
        return;
      }

      setBrowserEndpoint(subscription.endpoint);
      const endpointStatus = await fetchPushStatus(subscription.endpoint);
      setCanReceiveNotifications(Boolean(endpointStatus.canReceiveNotifications));
      setVapidPublicKeyConfigured(Boolean(endpointStatus.vapidPublicKeyConfigured));
      setVapidPublicKey(endpointStatus.vapidPublicKey ?? null);
      setDeviceActive(Boolean(endpointStatus.deviceActive));
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : 'No se pudo cargar el estado.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  const permissionText = useMemo(() => {
    if (loading || !support.checked) return 'Comprobando permisos del dispositivo...';
    if (!support.supported) return 'Este navegador no soporta notificaciones push.';
    if (permission === 'denied') {
      return 'Las notificaciones estan bloqueadas en este navegador. Activalas desde los ajustes del dispositivo o navegador.';
    }
    if (!canReceiveNotifications) {
      return 'No tienes activado el permiso para recibir notificaciones de reservas externas.';
    }
    if (!vapidPublicKeyConfigured) {
      return 'La configuracion de Web Push esta incompleta. Falta NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY.';
    }
    return 'Puedes activar notificaciones de reservas externas en este dispositivo.';
  }, [canReceiveNotifications, loading, permission, support.checked, support.supported, vapidPublicKeyConfigured]);

  const canActivateDevice = Boolean(
    support.supported &&
      canReceiveNotifications &&
      vapidPublicKeyConfigured &&
      vapidPublicKey &&
      permission !== 'denied',
  );

  const statusTone = deviceActive ? 'success' : 'muted';

  const handleActivate = async () => {
    if (!canActivateDevice || !vapidPublicKey) return;

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      let nextPermission = Notification.permission;

      if (nextPermission === 'default') {
        nextPermission = await Notification.requestPermission();
        setPermission(nextPermission);
      }

      if (nextPermission !== 'granted') {
        throw new Error(
          nextPermission === 'denied'
            ? 'Las notificaciones estan bloqueadas en este navegador. Activalas desde los ajustes del dispositivo o navegador.'
            : 'Permiso de notificaciones no concedido.',
        );
      }

      const registration = await getPushRegistration();
      const existingSubscription = await registration.pushManager.getSubscription();
      const subscription =
        existingSubscription ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        }));

      const subscriptionJson = subscription.toJSON() as {
        endpoint?: string;
        keys?: {
          p256dh?: string;
          auth?: string;
        };
      };

      if (!subscriptionJson.endpoint || !subscriptionJson.keys?.p256dh || !subscriptionJson.keys.auth) {
        throw new Error('El navegador no devolvio una subscription Web Push valida.');
      }

      const response = await fetch('/api/notifications/push-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: subscriptionJson.endpoint,
          keys: {
            p256dh: subscriptionJson.keys.p256dh,
            auth: subscriptionJson.keys.auth,
          },
          deviceLabel: getDeviceLabel(),
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as PushStatusResponse;

      if (!response.ok) {
        throw new Error(payload.error || 'No se pudo activar este dispositivo.');
      }

      setBrowserEndpoint(subscriptionJson.endpoint);
      setDeviceActive(true);
      setMessage('Este dispositivo esta activo.');
    } catch (activateError) {
      setError(activateError instanceof Error ? activateError.message : 'No se pudo activar este dispositivo.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const registration = support.supported ? await getPushRegistration() : null;
      const subscription = registration ? await registration.pushManager.getSubscription() : null;
      const endpoint = subscription?.endpoint ?? browserEndpoint;

      if (!endpoint) {
        setDeviceActive(false);
        setMessage('Este dispositivo no esta activo.');
        return;
      }

      const response = await fetch('/api/notifications/push-subscription', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint }),
      });
      const payload = (await response.json().catch(() => ({}))) as PushStatusResponse;

      if (!response.ok) {
        throw new Error(payload.error || 'No se pudo desactivar este dispositivo.');
      }

      if (subscription) {
        await subscription.unsubscribe();
      }

      setDeviceActive(false);
      setBrowserEndpoint(null);
      setMessage('Este dispositivo no esta activo.');
    } catch (deactivateError) {
      setError(deactivateError instanceof Error ? deactivateError.message : 'No se pudo desactivar este dispositivo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <OperationalPanel className="p-5">
        <OperationalSectionHeader
          icon={BellAlertIcon}
          title="Reservas externas"
          meta={
            <OperationalPill tone={canActivateDevice ? 'success' : 'warning'}>
              {canActivateDevice ? 'Disponible' : 'Revisar'}
            </OperationalPill>
          }
        >
          Gestiona si este navegador puede recibir futuros avisos internos.
        </OperationalSectionHeader>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <div className="operational-inset rounded-2xl border border-[#3c342a]/70 bg-[#12110f]/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#a99d90]">
              Estado de permisos
            </p>
            <p className="mt-2 text-sm leading-6 text-[#efe8dc]">{permissionText}</p>
          </div>

          <div className="operational-inset rounded-2xl border border-[#3c342a]/70 bg-[#12110f]/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#a99d90]">
              Estado del dispositivo
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <OperationalPill tone={statusTone}>
                {deviceActive ? 'Este dispositivo esta activo' : 'Este dispositivo no esta activo'}
              </OperationalPill>
              {browserEndpoint ? <OperationalPill tone="muted">Subscription detectada</OperationalPill> : null}
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          {deviceActive ? (
            <button
              type="button"
              onClick={handleDeactivate}
              disabled={saving || loading}
              className={`${operationalSecondaryButtonClass} min-h-11 sm:min-h-0`}
            >
              <DevicePhoneMobileIcon className="h-4 w-4" aria-hidden="true" />
              {saving ? 'Desactivando...' : 'Desactivar notificaciones en este dispositivo'}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleActivate}
              disabled={saving || loading || !canActivateDevice}
              className={`${operationalPrimaryButtonClass} min-h-11 sm:min-h-0`}
            >
              <DevicePhoneMobileIcon className="h-4 w-4" aria-hidden="true" />
              {saving ? 'Activando...' : 'Activar notificaciones en este dispositivo'}
            </button>
          )}

          <button
            type="button"
            onClick={() => void refreshStatus()}
            disabled={saving || loading}
            className={`${operationalSecondaryButtonClass} min-h-11 sm:min-h-0`}
          >
            Actualizar estado
          </button>
        </div>

        {error ? <p className="mt-4 text-sm text-amber-200">{error}</p> : null}
        {message ? <p className="mt-4 text-sm text-emerald-300">{message}</p> : null}
      </OperationalPanel>
    </div>
  );
}

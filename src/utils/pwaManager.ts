import { supabase } from '../lib/supabaseClient';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export interface PwaUpdateInfo {
  available: boolean;
  latestVersion: string | null;
  reason: 'sw_waiting' | 'version_mismatch' | null;
}

let cachedSwRegistration: ServiceWorkerRegistration | null = null;

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }
  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
      updateViaCache: 'none',
    });
    cachedSwRegistration = registration;
    return registration;
  } catch (err) {
    console.warn('[PWA] Falha ao registrar Service Worker:', err);
    return null;
  }
}

export async function checkForPwaUpdate(currentVersion: string): Promise<PwaUpdateInfo> {
  if (typeof window === 'undefined') {
    return { available: false, latestVersion: null, reason: null };
  }

  let hasWaitingSw = false;
  try {
    if ('serviceWorker' in navigator) {
      const reg = cachedSwRegistration || (await navigator.serviceWorker.getRegistration('/'));
      if (reg) {
        cachedSwRegistration = reg;
        await reg.update().catch(() => {});
        if (reg.waiting && navigator.serviceWorker.controller) {
          hasWaitingSw = true;
        }
      }
    }
  } catch {
    // ignore SW check errors
  }

  let remoteVersion: string | null = null;
  try {
    const resp = await fetch(`/version.json?t=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' },
    });
    if (resp.ok) {
      const data = await resp.json();
      if (data && typeof data.version === 'string' && data.version.trim()) {
        remoteVersion = data.version.trim();
      }
    }
  } catch {
    // ignore offline fetch errors
  }

  const normalizedCurrent = (currentVersion || '').trim();
  const hasVersionMismatch = Boolean(remoteVersion && normalizedCurrent && remoteVersion !== normalizedCurrent);

  if (hasVersionMismatch) {
    return {
      available: true,
      latestVersion: remoteVersion,
      reason: 'version_mismatch',
    };
  }

  if (hasWaitingSw) {
    return {
      available: true,
      latestVersion: remoteVersion,
      reason: 'sw_waiting',
    };
  }

  return {
    available: false,
    latestVersion: remoteVersion || normalizedCurrent || null,
    reason: null,
  };
}

export function startPwaUpdateWatcher(
  currentVersion: string,
  onUpdateAvailable: (info: PwaUpdateInfo) => void
): () => void {
  if (typeof window === 'undefined') return () => {};

  let stopped = false;
  let lastNotifiedKey = '';
  let trackedReg: ServiceWorkerRegistration | null = null;

  const emitIfAvailable = (info: PwaUpdateInfo) => {
    if (stopped || !info.available) return;
    const key = `${info.reason}:${info.latestVersion || ''}`;
    if (key === lastNotifiedKey) return;
    lastNotifiedKey = key;
    onUpdateAvailable(info);
  };

  const runCheck = async () => {
    if (stopped) return;
    const info = await checkForPwaUpdate(currentVersion);
    emitIfAvailable(info);
  };

  const handleUpdateFound = () => {
    const installing = trackedReg?.installing;
    if (!installing) return;
    installing.addEventListener('statechange', () => {
      if (installing.state === 'installed' && navigator.serviceWorker.controller) {
        runCheck().then(() => {
          emitIfAvailable({
            available: true,
            latestVersion: null,
            reason: 'sw_waiting',
          });
        });
      }
    });
  };

  registerServiceWorker().then((reg) => {
    if (stopped || !reg) return;
    trackedReg = reg;
    if (reg.waiting && navigator.serviceWorker.controller) {
      runCheck();
    }
    reg.addEventListener('updatefound', handleUpdateFound);
  });

  const initialTimer = window.setTimeout(runCheck, 3000);
  const intervalId = window.setInterval(runCheck, 5 * 60 * 1000);

  const handleVisibility = () => {
    if (document.visibilityState === 'visible') {
      runCheck();
    }
  };
  const handleFocus = () => {
    runCheck();
  };

  document.addEventListener('visibilitychange', handleVisibility);
  window.addEventListener('focus', handleFocus);

  return () => {
    stopped = true;
    window.clearTimeout(initialTimer);
    window.clearInterval(intervalId);
    document.removeEventListener('visibilitychange', handleVisibility);
    window.removeEventListener('focus', handleFocus);
    if (trackedReg) {
      trackedReg.removeEventListener('updatefound', handleUpdateFound);
    }
  };
}

export async function applyPwaUpdate(): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    if ('serviceWorker' in navigator) {
      const reg = cachedSwRegistration || (await navigator.serviceWorker.getRegistration('/'));
      if (reg) {
        await reg.update().catch(() => {});
        if (reg.waiting) {
          await new Promise<void>((resolve) => {
            let resolved = false;
            const done = () => {
              if (!resolved) {
                resolved = true;
                resolve();
              }
            };
            const onControllerChange = () => {
              navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
              done();
            };
            navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
            reg.waiting?.postMessage({ type: 'SKIP_WAITING' });
            window.setTimeout(done, 1200);
          });
        }
      }
    }
  } catch {
    // ignore SW skipWaiting errors
  }

  try {
    if ('caches' in window) {
      const cacheKeys = await window.caches.keys();
      await Promise.all(cacheKeys.map((k) => window.caches.delete(k)));
    }
  } catch {
    // ignore cache clear errors
  }

  window.location.reload();
}

export function isPwaStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    Boolean(nav.standalone)
  );
}

export function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function arrayBufferToBase64(buffer: ArrayBuffer | null): string {
  if (!buffer) return '';
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function isValidUuid(val?: string): boolean {
  return Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));
}

export async function requestAndSubscribeWebPush(
  userId?: string,
  tenantId?: string
): Promise<{
  granted: boolean;
  subscribedToPush: boolean;
  mode: 'vapid_push' | 'local_sw' | 'denied';
  message: string;
}> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return {
      granted: false,
      subscribedToPush: false,
      mode: 'denied',
      message: 'Este navegador não suporta notificações Web Push.',
    };
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return {
      granted: false,
      subscribedToPush: false,
      mode: 'denied',
      message: 'Permissão de notificação negada. Ative nas configurações do navegador.',
    };
  }

  const reg = await registerServiceWorker();
  const vapidPublicKey = import.meta.env?.VITE_VAPID_PUBLIC_KEY as string | undefined;

  if (reg && 'pushManager' in reg && vapidPublicKey) {
    try {
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });
      }

      const p256dh = arrayBufferToBase64(sub.getKey('p256dh'));
      const auth = arrayBufferToBase64(sub.getKey('auth'));

      if (supabase && userId) {
        await supabase.from('push_subscriptions').upsert(
          {
            user_id: userId,
            tenant_id: isValidUuid(tenantId) ? tenantId : null,
            endpoint: sub.endpoint,
            p256dh,
            auth,
            user_agent: navigator.userAgent,
            active: true,
          },
          { onConflict: 'endpoint' }
        );
      }

      return {
        granted: true,
        subscribedToPush: true,
        mode: 'vapid_push',
        message: 'Push Web ativado e inscrito para alertas em segundo plano!',
      };
    } catch (err: any) {
      console.warn('[PWA Push Subscribe Warning]', err?.message || err);
    }
  }

  return {
    granted: true,
    subscribedToPush: false,
    mode: 'local_sw',
    message:
      'Notificações permitidas via Service Worker! (Defina VITE_VAPID_PUBLIC_KEY para push em background via servidor).',
  };
}

export async function sendTestLocalNotification(
  title: string,
  body: string,
  iconUrl = '/icon-192.png'
): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;

  let permission = Notification.permission;
  if (permission === 'default') {
    permission = await Notification.requestPermission();
  }
  if (permission !== 'granted') return false;

  const options: NotificationOptions & { vibrate?: number[] } = {
    body,
    icon: iconUrl,
    badge: '/icon-192.png',
    tag: `radar-ia-test-${Date.now()}`,
    vibrate: [150, 80, 150],
    data: { url: '/' },
  };

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      if (reg && typeof reg.showNotification === 'function') {
        await reg.showNotification(title, options);
        return true;
      }
    }
  } catch {
    // Fallback para Notification API direta
  }

  try {
    new Notification(title, options);
    return true;
  } catch {
    return false;
  }
}

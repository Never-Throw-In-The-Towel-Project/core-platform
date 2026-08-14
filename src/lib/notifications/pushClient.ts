import { subscribeToPush } from "@/lib/actions/pushSubscription";

/** Whether this browser can do web push at all (SSR-safe). */
export function isPushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
}

// The Push API wants the VAPID public key as a raw Uint8Array, not the
// base64url string NEXT_PUBLIC_VAPID_PUBLIC_KEY is stored as. `new
// Uint8Array(length)` (rather than `Uint8Array.from(...)`) guarantees a plain
// ArrayBuffer-backed array -- lib.dom types Uint8Array.from's result as backed
// by the broader ArrayBufferLike (which includes SharedArrayBuffer), which
// PushSubscriptionOptionsInit.applicationServerKey's BufferSource doesn't accept.
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const bytes = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    bytes[i] = rawData.charCodeAt(i);
  }
  return bytes;
}

/**
 * Request notification permission, register the service worker, subscribe to
 * push, and persist the subscription server-side. Shared by the Settings toggle
 * and the onboarding prompt so there is exactly one implementation of the
 * browser dance. Never throws -- returns a result the caller can render.
 */
export async function enablePushSubscription(): Promise<{ ok: boolean; error?: string }> {
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return { ok: false, error: "Notifications permission wasn't granted." };
    }

    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) {
      return { ok: false, error: "Push notifications aren't configured yet." };
    }

    const registration = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });

    const json = subscription.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
      return { ok: false, error: "Something went wrong enabling notifications. Please try again." };
    }

    const result = await subscribeToPush({
      endpoint: json.endpoint,
      keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
    });
    if (!result.ok) {
      return { ok: false, error: "Something went wrong saving this. Please try again." };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Something went wrong enabling notifications. Please try again." };
  }
}

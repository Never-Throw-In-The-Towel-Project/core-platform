"use client";

import { useState, useTransition } from "react";
import { subscribeToPush, unsubscribeFromPush } from "@/lib/actions/pushSubscription";

// The Push API wants the VAPID public key as a raw Uint8Array, not the
// base64url string NEXT_PUBLIC_VAPID_PUBLIC_KEY is stored as.
// `new Uint8Array(length)` (rather than `Uint8Array.from(...)`) guarantees
// a plain ArrayBuffer-backed array -- lib.dom types Uint8Array.from's result
// as backed by the broader ArrayBufferLike (which includes SharedArrayBuffer),
// which PushSubscriptionOptionsInit.applicationServerKey's BufferSource type
// doesn't accept.
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

export function PushNotificationToggle({ initiallySubscribed }: { initiallySubscribed: boolean }) {
  const [subscribed, setSubscribed] = useState(initiallySubscribed);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const supported =
    typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;

  function handleEnable() {
    setError(null);
    startTransition(async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setError("Notifications permission wasn't granted.");
          return;
        }

        const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!vapidPublicKey) {
          setError("Push notifications aren't configured yet.");
          return;
        }

        const registration = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;

        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });

        const json = subscription.toJSON();
        if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
          setError("Something went wrong enabling notifications. Please try again.");
          return;
        }

        const result = await subscribeToPush({
          endpoint: json.endpoint,
          keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
        });

        if (result.ok) {
          setSubscribed(true);
        } else {
          setError("Something went wrong saving this. Please try again.");
        }
      } catch {
        setError("Something went wrong enabling notifications. Please try again.");
      }
    });
  }

  function handleDisable() {
    setError(null);
    startTransition(async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          await unsubscribeFromPush(subscription.endpoint);
          await subscription.unsubscribe();
        }
        setSubscribed(false);
      } catch {
        setError("Something went wrong. Please try again.");
      }
    });
  }

  if (!supported) {
    return (
      <div className="rounded-lg border border-black/10 p-4 text-sm opacity-60">
        Push notifications aren&apos;t supported in this browser.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-black/10 p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium">Push notifications</p>
          <p className="mt-1 text-xs opacity-60">
            A reminder at your Morning/Night Routine and Sunday Setup times, if set.
          </p>
        </div>
        <button
          type="button"
          disabled={isPending}
          onClick={subscribed ? handleDisable : handleEnable}
          className="shrink-0 rounded-md border border-black/20 px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
        >
          {isPending ? "…" : subscribed ? "Enabled ✓" : "Enable"}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}

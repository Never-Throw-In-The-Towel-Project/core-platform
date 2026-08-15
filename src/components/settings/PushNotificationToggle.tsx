"use client";

import { useState, useTransition } from "react";
import { unsubscribeFromPush } from "@/lib/actions/pushSubscription";
import { enablePushSubscription, isPushSupported } from "@/lib/notifications/pushClient";

export function PushNotificationToggle({ initiallySubscribed }: { initiallySubscribed: boolean }) {
  const [subscribed, setSubscribed] = useState(initiallySubscribed);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const supported = isPushSupported();

  function handleEnable() {
    setError(null);
    startTransition(async () => {
      const result = await enablePushSubscription();
      if (result.ok) {
        setSubscribed(true);
      } else {
        setError(result.error ?? "Something went wrong. Please try again.");
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
      <div className="border border-rule-hairline p-4 text-sm text-muted">
        Push notifications aren&apos;t supported in this browser.
      </div>
    );
  }

  return (
    <div className="border border-rule-hairline p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium">Push notifications</p>
          <p className="mt-1 text-xs text-muted">
            A reminder at your Morning/Night Routine and Sunday Setup times, if set.
          </p>
        </div>
        <button
          type="button"
          disabled={isPending}
          onClick={subscribed ? handleDisable : handleEnable}
          className="shrink-0 border border-rule-border px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
        >
          {isPending ? "…" : subscribed ? "Enabled ✓" : "Enable"}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-brand-accent-deep">{error}</p>}
    </div>
  );
}

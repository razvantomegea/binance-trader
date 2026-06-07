"use client";

import { usePushNotificationToggle } from "@/hooks/use-push-notification-toggle";

function getButtonLabel(pending: boolean, isEnabled: boolean): string {
  if (pending) {
    return "Please wait...";
  }
  return isEnabled ? "Disable trade alerts" : "Enable trade alerts";
}

export function PushNotificationToggle() {
  const { state, message, pending, isEnabled, enablePush, disablePush } =
    usePushNotificationToggle();

  if (state === "unsupported") {
    return (
      <p className="text-xs text-zinc-500">
        Push notifications are not supported in this browser.
      </p>
    );
  }

  const label = getButtonLabel(pending, isEnabled);
  const onToggle = isEnabled ? disablePush : enablePush;

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => void onToggle()}
        disabled={pending || state === "loading"}
        className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
      >
        {label}
      </button>
      {message ? <p className="text-xs text-rose-500">{message}</p> : null}
    </div>
  );
}

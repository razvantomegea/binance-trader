import { getErrorDetails } from "@/utils/error-handling";
import { urlBase64ToUint8Array } from "@/utils/notifications/url-base64-to-uint8array";

export type PushState =
  | "unsupported"
  | "loading"
  | "disabled"
  | "enabled"
  | "error";

export interface PushStatus {
  state: PushState;
  message: string | null;
}

interface SaveSubscriptionParams {
  endpoint: string;
  p256dh: string;
  auth: string;
}

function getBrowserSubscription(
  registration: ServiceWorkerRegistration,
): Promise<PushSubscription | null> {
  return registration.pushManager.getSubscription();
}

function normalizeVapidPublicKey(value: string): string {
  const trimmed = value.trim();
  const wrappedInQuotes = trimmed.startsWith('"') && trimmed.endsWith('"');
  const withoutQuotes = wrappedInQuotes ? trimmed.slice(1, -1) : trimmed;
  return withoutQuotes.trim();
}

function toPushApplicationServerKey(
  value: Uint8Array,
): string | BufferSource | null | undefined {
  return Uint8Array.from(value);
}

async function getActiveServiceWorkerRegistration(): Promise<ServiceWorkerRegistration> {
  await navigator.serviceWorker.register("/sw.js");
  return navigator.serviceWorker.ready;
}

function isPushSupported(): boolean {
  return !(
    typeof window === "undefined" ||
    !("serviceWorker" in navigator) ||
    !("PushManager" in window) ||
    !("Notification" in window)
  );
}

async function readErrorResponseBody(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { error?: unknown; details?: unknown };
    const error = typeof data.error === "string" ? data.error : null;
    const details = typeof data.details === "string" ? data.details : null;
    return [error, details].filter(Boolean).join(" | ");
  } catch {
    return "";
  }
}

async function fetchVapidPublicKey(): Promise<string> {
  const vapidRes = await fetch("/api/push/vapid-public-key");
  if (!vapidRes.ok) {
    const errorBody = await readErrorResponseBody(vapidRes);
    console.error("[push-enable] vapid-public-key failed", {
      status: vapidRes.status,
      errorBody,
    });
    throw new Error("Push is not configured on server");
  }
  const { publicKey } = (await vapidRes.json()) as { publicKey: string };
  return publicKey;
}

async function saveSubscription(params: SaveSubscriptionParams): Promise<void> {
  const saveRes = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      endpoint: params.endpoint,
      keys: { p256dh: params.p256dh, auth: params.auth },
    }),
  });

  if (saveRes.ok) {
    return;
  }

  const errorBody = await readErrorResponseBody(saveRes);
  throw new Error(
    `Failed to save subscription (status ${saveRes.status}${errorBody ? `: ${errorBody}` : ""})`,
  );
}

export async function getPushStatus(): Promise<PushStatus> {
  if (!isPushSupported()) {
    return { state: "unsupported", message: null };
  }

  try {
    const registration = await getActiveServiceWorkerRegistration();
    const subscription = await getBrowserSubscription(registration);
    return { state: subscription ? "enabled" : "disabled", message: null };
  } catch {
    return { state: "error", message: "Could not register service worker" };
  }
}

function resolveEnableErrorMessage(err: unknown): string {
  const errMessage = getErrorDetails(err);
  if (errMessage.toLowerCase().includes("push service error")) {
    return "Browser push service blocked/unavailable. Disable blocking extensions/shields and retry.";
  }
  return "Failed to enable push notifications";
}

async function requestPermissionOrReturn(): Promise<PushStatus | null> {
  const permission = await Notification.requestPermission();
  if (permission === "granted") {
    return null;
  }
  return { state: "disabled", message: "Notification permission denied" };
}

async function createPushSubscription(publicKey: string) {
  const registration = await getActiveServiceWorkerRegistration();
  const normalizedPublicKey = normalizeVapidPublicKey(publicKey);
  const applicationServerKey = urlBase64ToUint8Array(normalizedPublicKey);
  if (applicationServerKey.length !== 65) {
    throw new Error(
      `Invalid VAPID public key length (${applicationServerKey.length} bytes)`,
    );
  }
  const existing = await getBrowserSubscription(registration);
  return (
    existing ??
    registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: toPushApplicationServerKey(applicationServerKey),
    })
  );
}

export async function enablePushNotifications(): Promise<PushStatus> {
  let step = "request-notification-permission";

  try {
    const permissionStatus = await requestPermissionOrReturn();
    if (permissionStatus !== null) {
      return permissionStatus;
    }

    step = "fetch-vapid-public-key";
    const publicKey = await fetchVapidPublicKey();

    step = "get-or-create-subscription";
    const subscription = await createPushSubscription(publicKey);

    const json = subscription.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) {
      throw new Error("Invalid push subscription");
    }

    step = "save-subscription";
    await saveSubscription({
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
    });
    return { state: "enabled", message: null };
  } catch (err) {
    console.error("[push-enable] failed", {
      step,
      error: getErrorDetails(err),
      notificationPermission: Notification.permission,
    });
    return { state: "error", message: resolveEnableErrorMessage(err) };
  }
}

export async function disablePushNotifications(): Promise<PushStatus> {
  let step = "register-service-worker";

  try {
    const registration = await getActiveServiceWorkerRegistration();
    const subscription = await getBrowserSubscription(registration);

    if (!subscription) {
      return { state: "disabled", message: null };
    }

    step = "remove-subscription-on-server";
    const removeRes = await fetch("/api/push/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    });
    if (!removeRes.ok) {
      const errorBody = await readErrorResponseBody(removeRes);
      throw new Error(
        `Failed to remove subscription (status ${removeRes.status}${errorBody ? `: ${errorBody}` : ""})`,
      );
    }

    step = "unsubscribe-browser";
    await subscription.unsubscribe();
    return { state: "disabled", message: null };
  } catch (err) {
    console.error("[push-disable] failed", {
      step,
      error: getErrorDetails(err),
    });
    return { state: "error", message: "Failed to disable push notifications" };
  }
}

import type { PushSubscriptionInput } from "@/helpers/notifications/types";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function parsePushSubscriptionBody(
  body: unknown,
): PushSubscriptionInput | null {
  if (typeof body !== "object" || body === null) {
    return null;
  }

  const record = body as Record<string, unknown>;
  const {endpoint} = record;
  const {keys} = record;

  if (!isNonEmptyString(endpoint)) {
    return null;
  }

  if (typeof keys !== "object" || keys === null) {
    return null;
  }

  const keysRecord = keys as Record<string, unknown>;
  const {p256dh} = keysRecord;
  const {auth} = keysRecord;

  if (!isNonEmptyString(p256dh) || !isNonEmptyString(auth)) {
    return null;
  }

  return {
    endpoint: endpoint.trim(),
    keys: { p256dh: p256dh.trim(), auth: auth.trim() },
  };
}

export function parseUnsubscribeBody(
  body: unknown,
): { endpoint: string } | null {
  if (typeof body !== "object" || body === null) {
    return null;
  }

  const {endpoint} = (body as Record<string, unknown>);
  if (!isNonEmptyString(endpoint)) {
    return null;
  }

  return { endpoint: endpoint.trim() };
}

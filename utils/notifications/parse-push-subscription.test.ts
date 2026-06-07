import { describe, expect, it } from "vitest";

import {
  parsePushSubscriptionBody,
  parseUnsubscribeBody,
} from "./parse-push-subscription";

describe("parsePushSubscriptionBody", () => {
  it("parses a valid subscription body", () => {
    expect(
      parsePushSubscriptionBody({
        endpoint: "https://push.example/sub/1",
        keys: { p256dh: "key-a", auth: "key-b" },
      }),
    ).toEqual({
      endpoint: "https://push.example/sub/1",
      keys: { p256dh: "key-a", auth: "key-b" },
    });
  });

  it("trims endpoint and key values", () => {
    expect(
      parsePushSubscriptionBody({
        endpoint: "  https://push.example/sub/1  ",
        keys: { p256dh: "  key-a  ", auth: "  key-b  " },
      }),
    ).toEqual({
      endpoint: "https://push.example/sub/1",
      keys: { p256dh: "key-a", auth: "key-b" },
    });
  });

  it("returns null for non-object bodies", () => {
    expect(parsePushSubscriptionBody(null)).toBeNull();
    expect(parsePushSubscriptionBody("bad")).toBeNull();
    expect(parsePushSubscriptionBody(42)).toBeNull();
  });

  it("returns null when endpoint is missing or empty", () => {
    expect(
      parsePushSubscriptionBody({ keys: { p256dh: "a", auth: "b" } }),
    ).toBeNull();
    expect(
      parsePushSubscriptionBody({
        endpoint: "   ",
        keys: { p256dh: "a", auth: "b" },
      }),
    ).toBeNull();
  });

  it("returns null when keys are missing or invalid", () => {
    expect(
      parsePushSubscriptionBody({ endpoint: "https://push.example/sub/1" }),
    ).toBeNull();
    expect(
      parsePushSubscriptionBody({
        endpoint: "https://push.example/sub/1",
        keys: null,
      }),
    ).toBeNull();
    expect(
      parsePushSubscriptionBody({
        endpoint: "https://push.example/sub/1",
        keys: { p256dh: "a" },
      }),
    ).toBeNull();
    expect(
      parsePushSubscriptionBody({
        endpoint: "https://push.example/sub/1",
        keys: { p256dh: "  ", auth: "b" },
      }),
    ).toBeNull();
  });
});

describe("parseUnsubscribeBody", () => {
  it("parses a valid unsubscribe body", () => {
    expect(
      parseUnsubscribeBody({ endpoint: "https://push.example/sub/1" }),
    ).toEqual({ endpoint: "https://push.example/sub/1" });
  });

  it("trims endpoint", () => {
    expect(
      parseUnsubscribeBody({ endpoint: "  https://push.example/sub/1  " }),
    ).toEqual({ endpoint: "https://push.example/sub/1" });
  });

  it("returns null for non-object bodies", () => {
    expect(parseUnsubscribeBody(undefined)).toBeNull();
    expect(parseUnsubscribeBody([])).toBeNull();
  });

  it("returns null when endpoint is missing or empty", () => {
    expect(parseUnsubscribeBody({})).toBeNull();
    expect(parseUnsubscribeBody({ endpoint: "" })).toBeNull();
    expect(parseUnsubscribeBody({ endpoint: "   " })).toBeNull();
  });
});

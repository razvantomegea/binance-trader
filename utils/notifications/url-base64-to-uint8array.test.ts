import { describe, expect, it } from "vitest";

import { urlBase64ToUint8Array } from "./url-base64-to-uint8array";

describe("urlBase64ToUint8Array", () => {
  it("decodes standard base64 without padding", () => {
    expect(Array.from(urlBase64ToUint8Array("YQ"))).toEqual([97]);
    expect(Array.from(urlBase64ToUint8Array("YWI"))).toEqual([97, 98]);
  });

  it("decodes URL-safe base64 characters", () => {
    const standard = urlBase64ToUint8Array("+/AB");
    const urlSafe = urlBase64ToUint8Array("-_AB");

    expect(Array.from(urlSafe)).toEqual(Array.from(standard));
  });

  it("adds padding when input length is not a multiple of four", () => {
    expect(Array.from(urlBase64ToUint8Array("YQ"))).toEqual([97]);
    expect(Array.from(urlBase64ToUint8Array("YWI"))).toEqual([97, 98]);
    expect(Array.from(urlBase64ToUint8Array("YWJj"))).toEqual([97, 98, 99]);
  });

  it("round-trips known binary payload", () => {
    const bytes = [0, 1, 2, 255, 128, 64];
    const base64 = btoa(String.fromCharCode(...bytes));

    expect(Array.from(urlBase64ToUint8Array(base64))).toEqual(bytes);
  });
});

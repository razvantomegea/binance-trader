import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resolveVapidDetails, resolveVapidPublicKey } from "./vapid-env";

const VALID_PUBLIC_KEY = "B".repeat(88);
const VALID_PRIVATE_KEY = "private-key-value";

describe("resolveVapidPublicKey / resolveVapidDetails", () => {
  let envDir: string;
  let envFilePath: string;

  beforeEach(async () => {
    delete process.env.WEB_PUSH_VAPID_PUBLIC_KEY;
    delete process.env.WEB_PUSH_VAPID_PRIVATE_KEY;
    delete process.env.WEB_PUSH_SUBJECT;
    envDir = await mkdtemp(join(tmpdir(), "vapid-env-"));
    envFilePath = join(envDir, ".env.local");
  });

  afterEach(async () => {
    delete process.env.WEB_PUSH_VAPID_PUBLIC_KEY;
    delete process.env.WEB_PUSH_VAPID_PRIVATE_KEY;
    delete process.env.WEB_PUSH_SUBJECT;
    await rm(envDir, { recursive: true, force: true });
  });

  it("returns null in non-development when keys are missing", async () => {
    await expect(
      resolveVapidPublicKey({ nodeEnv: "test", envFilePath }),
    ).resolves.toBeNull();
    await expect(
      resolveVapidDetails({ nodeEnv: "production", envFilePath }),
    ).resolves.toBeNull();
  });

  it("returns the normalized public key from env without generating", async () => {
    process.env.WEB_PUSH_VAPID_PUBLIC_KEY = `"${VALID_PUBLIC_KEY}"`;
    process.env.WEB_PUSH_VAPID_PRIVATE_KEY = VALID_PRIVATE_KEY;
    process.env.WEB_PUSH_SUBJECT = "mailto:test@example.com";

    await expect(
      resolveVapidPublicKey({ nodeEnv: "development", envFilePath }),
    ).resolves.toBe(VALID_PUBLIC_KEY);

    await expect(
      resolveVapidDetails({ nodeEnv: "development", envFilePath }),
    ).resolves.toEqual({
      publicKey: VALID_PUBLIC_KEY,
      privateKey: VALID_PRIVATE_KEY,
      subject: "mailto:test@example.com",
    });
  });

  it("defaults subject only in development when the pair exists", async () => {
    process.env.WEB_PUSH_VAPID_PUBLIC_KEY = VALID_PUBLIC_KEY;
    process.env.WEB_PUSH_VAPID_PRIVATE_KEY = VALID_PRIVATE_KEY;

    await expect(
      resolveVapidDetails({ nodeEnv: "production", envFilePath }),
    ).resolves.toBeNull();
    await expect(
      resolveVapidDetails({ nodeEnv: "development", envFilePath }),
    ).resolves.toEqual({
      publicKey: VALID_PUBLIC_KEY,
      privateKey: VALID_PRIVATE_KEY,
      subject: "mailto:dev@localhost",
    });
  });

  it("generates and persists development keys when missing", async () => {
    await writeFile(
      envFilePath,
      [
        "DATABASE_URL=postgresql://trading:trading@localhost:5432/trading",
        "# WEB_PUSH_VAPID_PUBLIC_KEY=",
        "# WEB_PUSH_VAPID_PRIVATE_KEY=",
        "# WEB_PUSH_SUBJECT=mailto:you@example.com",
        "",
      ].join("\n"),
    );

    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    const details = await resolveVapidDetails({
      nodeEnv: "development",
      envFilePath,
    });

    infoSpy.mockRestore();

    expect(details).not.toBeNull();
    expect(details?.publicKey.length).toBeGreaterThanOrEqual(80);
    expect(details?.privateKey.length).toBeGreaterThan(0);
    expect(details?.subject).toBe("mailto:dev@localhost");
    expect(process.env.WEB_PUSH_VAPID_PUBLIC_KEY).toBe(details?.publicKey);
    expect(process.env.WEB_PUSH_VAPID_PRIVATE_KEY).toBe(details?.privateKey);

    const written = await readFile(envFilePath, "utf8");
    expect(written).toContain(
      "DATABASE_URL=postgresql://trading:trading@localhost:5432/trading",
    );
    expect(written).toContain(
      `WEB_PUSH_VAPID_PUBLIC_KEY=${details?.publicKey}`,
    );
    expect(written).toContain(
      `WEB_PUSH_VAPID_PRIVATE_KEY=${details?.privateKey}`,
    );
    expect(written).toContain("WEB_PUSH_SUBJECT=mailto:dev@localhost");
    expect(written).not.toMatch(/^#\s*WEB_PUSH_VAPID_PUBLIC_KEY=/m);
  });

  it("hydrates process env from the env file before generating", async () => {
    await writeFile(
      envFilePath,
      [
        `WEB_PUSH_VAPID_PUBLIC_KEY=${VALID_PUBLIC_KEY}`,
        `WEB_PUSH_VAPID_PRIVATE_KEY=${VALID_PRIVATE_KEY}`,
        "WEB_PUSH_SUBJECT=mailto:file@example.com",
        "",
      ].join("\n"),
    );

    await expect(
      resolveVapidDetails({ nodeEnv: "development", envFilePath }),
    ).resolves.toEqual({
      publicKey: VALID_PUBLIC_KEY,
      privateKey: VALID_PRIVATE_KEY,
      subject: "mailto:file@example.com",
    });
    expect(process.env.WEB_PUSH_VAPID_PUBLIC_KEY).toBe(VALID_PUBLIC_KEY);
    expect(process.env.WEB_PUSH_VAPID_PRIVATE_KEY).toBe(VALID_PRIVATE_KEY);
  });

  it("does not replace an existing public key when the private key is missing", async () => {
    process.env.WEB_PUSH_VAPID_PUBLIC_KEY = VALID_PUBLIC_KEY;

    await expect(
      resolveVapidDetails({ nodeEnv: "development", envFilePath }),
    ).resolves.toBeNull();
    await expect(
      resolveVapidPublicKey({ nodeEnv: "development", envFilePath }),
    ).resolves.toBe(VALID_PUBLIC_KEY);
    expect(process.env.WEB_PUSH_VAPID_PRIVATE_KEY).toBeUndefined();
  });

  it("returns null when development key persistence fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      resolveVapidDetails({
        nodeEnv: "development",
        envFilePath: envDir,
      }),
    ).resolves.toBeNull();

    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});

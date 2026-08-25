import { readFile, writeFile } from "node:fs/promises";

import webpush from "web-push";

export interface VapidDetails {
  publicKey: string;
  privateKey: string;
  subject: string;
}

export interface ResolveVapidOptions {
  nodeEnv?: string;
  envFilePath?: string;
}

const DEFAULT_DEV_SUBJECT = "mailto:dev@localhost";
const DEFAULT_ENV_FILE = ".env.local";

function normalizeEnvValue(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  const wrappedInQuotes = trimmed.startsWith('"') && trimmed.endsWith('"');
  const withoutQuotes = wrappedInQuotes ? trimmed.slice(1, -1) : trimmed;
  const normalized = withoutQuotes.trim();
  return normalized.length > 0 ? normalized : null;
}

function readPublicKeyFromProcessEnv(): string | null {
  return normalizeEnvValue(process.env.WEB_PUSH_VAPID_PUBLIC_KEY);
}

function readDetailsFromProcessEnv(
  nodeEnv: string | undefined,
): VapidDetails | null {
  const publicKey = readPublicKeyFromProcessEnv();
  const privateKey = normalizeEnvValue(process.env.WEB_PUSH_VAPID_PRIVATE_KEY);
  if (!publicKey || !privateKey) {
    return null;
  }

  const subject = normalizeEnvValue(process.env.WEB_PUSH_SUBJECT);
  if (subject) {
    return { publicKey, privateKey, subject };
  }

  if (nodeEnv === "development") {
    return { publicKey, privateKey, subject: DEFAULT_DEV_SUBJECT };
  }

  return null;
}

function readUncommentedEnvFileValue(
  content: string,
  key: string,
): string | null {
  const match = content.match(new RegExp(`^${key}=(.*)$`, "m"));
  if (!match) {
    return null;
  }
  return normalizeEnvValue(match[1]);
}

async function hydrateProcessEnvFromFile(envFilePath: string): Promise<void> {
  let content: string;
  try {
    content = await readFile(envFilePath, "utf8");
  } catch {
    return;
  }

  const keys = [
    "WEB_PUSH_VAPID_PUBLIC_KEY",
    "WEB_PUSH_VAPID_PRIVATE_KEY",
    "WEB_PUSH_SUBJECT",
  ] as const;

  for (const key of keys) {
    if (normalizeEnvValue(process.env[key])) {
      continue;
    }
    const fromFile = readUncommentedEnvFileValue(content, key);
    if (fromFile) {
      process.env[key] = fromFile;
    }
  }
}

function upsertEnvVar(content: string, key: string, value: string): string {
  const line = `${key}=${value}`;
  const uncommented = new RegExp(`^${key}=.*$`, "m");
  if (uncommented.test(content)) {
    return content.replace(uncommented, line);
  }

  const commented = new RegExp(`^#\\s*${key}=.*$`, "m");
  if (commented.test(content)) {
    return content.replace(commented, line);
  }

  const needsNewline = content.length > 0 && !content.endsWith("\n");
  return `${content}${needsNewline ? "\n" : ""}${line}\n`;
}

async function persistVapidDetails(
  envFilePath: string,
  details: VapidDetails,
): Promise<void> {
  let content = "";
  try {
    content = await readFile(envFilePath, "utf8");
  } catch (err) {
    const { code } = err as NodeJS.ErrnoException;
    if (code !== "ENOENT") {
      throw err;
    }
  }

  content = upsertEnvVar(
    content,
    "WEB_PUSH_VAPID_PUBLIC_KEY",
    details.publicKey,
  );
  content = upsertEnvVar(
    content,
    "WEB_PUSH_VAPID_PRIVATE_KEY",
    details.privateKey,
  );
  content = upsertEnvVar(content, "WEB_PUSH_SUBJECT", details.subject);
  await writeFile(envFilePath, content, "utf8");
}

function assignDetailsToProcessEnv(details: VapidDetails): void {
  process.env.WEB_PUSH_VAPID_PUBLIC_KEY = details.publicKey;
  process.env.WEB_PUSH_VAPID_PRIVATE_KEY = details.privateKey;
  process.env.WEB_PUSH_SUBJECT = details.subject;
}

let generateInFlight: Promise<VapidDetails> | null = null;

async function generateAndPersist(envFilePath: string): Promise<VapidDetails> {
  if (generateInFlight) {
    return generateInFlight;
  }

  generateInFlight = (async () => {
    const keys = webpush.generateVAPIDKeys();
    const details: VapidDetails = {
      publicKey: keys.publicKey,
      privateKey: keys.privateKey,
      subject:
        normalizeEnvValue(process.env.WEB_PUSH_SUBJECT) ?? DEFAULT_DEV_SUBJECT,
    };
    await persistVapidDetails(envFilePath, details);
    assignDetailsToProcessEnv(details);
    console.info(
      `Generated development web push VAPID keys and wrote them to ${envFilePath}`,
    );
    return details;
  })().finally(() => {
    generateInFlight = null;
  });

  return generateInFlight;
}

function resolveEnvFilePath(options: ResolveVapidOptions): string | null {
  if (options.envFilePath) {
    return options.envFilePath;
  }

  if (process.env.VITEST) {
    return null;
  }

  return DEFAULT_ENV_FILE;
}

function resolveNodeEnv(options: ResolveVapidOptions): string | undefined {
  return options.nodeEnv ?? process.env.NODE_ENV;
}

export async function resolveVapidDetails(
  options: ResolveVapidOptions = {},
): Promise<VapidDetails | null> {
  const envFilePath = resolveEnvFilePath(options);
  const nodeEnv = resolveNodeEnv(options);
  if (envFilePath) {
    await hydrateProcessEnvFromFile(envFilePath);
  }

  const existing = readDetailsFromProcessEnv(nodeEnv);
  if (existing) {
    return existing;
  }

  const publicKey = readPublicKeyFromProcessEnv();
  if (publicKey) {
    return null;
  }

  if (nodeEnv !== "development" || !envFilePath) {
    return null;
  }

  try {
    return await generateAndPersist(envFilePath);
  } catch (err) {
    console.error("Failed to generate development VAPID keys", err);
    return null;
  }
}

export async function resolveVapidPublicKey(
  options: ResolveVapidOptions = {},
): Promise<string | null> {
  const envFilePath = resolveEnvFilePath(options);
  if (envFilePath) {
    await hydrateProcessEnvFromFile(envFilePath);
  }

  const publicKey = readPublicKeyFromProcessEnv();
  if (publicKey) {
    return publicKey;
  }

  const details = await resolveVapidDetails(options);
  return details?.publicKey ?? null;
}

#!/usr/bin/env node

const REQUEST_TIMEOUT_MS = 120_000;

function resolveCronUrl() {
  const explicit = process.env.CRON_URL?.trim();
  if (explicit) {
    return explicit;
  }

  const domain =
    process.env.CRON_TARGET_DOMAIN?.trim() ??
    process.env.RAILWAY_SERVICE_BINANCE_TRADING_URL?.trim();

  if (!domain) {
    return null;
  }

  let base = domain;
  if (domain.startsWith("http://")) {
    base = domain.replace("http://", "https://");
  } else if (!domain.startsWith("https://")) {
    base = `https://${domain}`;
  }

  return `${base.replace(/\/$/, "")}/api/cron/run-strategy`;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

const cronUrl = resolveCronUrl();
const cronSecret = process.env.CRON_SECRET?.trim();

if (!cronUrl) {
  fail(
    "Missing CRON_URL (or CRON_TARGET_DOMAIN / RAILWAY_SERVICE_BINANCE_TRADING_URL)",
  );
}

if (!cronSecret) {
  fail("Missing CRON_SECRET");
}

const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

try {
  const response = await fetch(cronUrl, {
    method: "GET",
    headers: { Authorization: `Bearer ${cronSecret}` },
    signal: controller.signal,
  });

  const body = await response.text();

  if (!response.ok) {
    fail(`Strategy cron failed (${response.status}): ${body || "empty body"}`);
  }

  console.log(`Strategy cron OK (${response.status}): ${body || "empty body"}`);
} catch (error) {
  const message =
    error instanceof Error ? error.message : "Strategy cron request failed";
  fail(message);
} finally {
  clearTimeout(timeout);
}

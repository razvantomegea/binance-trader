function parseNonNegativeInteger(value, flag) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${flag} must be a non-negative integer`);
  }
  return parsed;
}

function parseNonNegativeNumber(value, flag) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${flag} must be a non-negative number`);
  }
  return parsed;
}

function printHelpAndExit(helpText) {
  if (helpText) {
    console.log(helpText.trim());
  }
  process.exit(0);
}

export function parseCleanupCliArgs(argv, helpText) {
  let dryRun = false;
  let keep = 0;
  let maxAgeDays = null;

  for (const arg of argv) {
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (arg.startsWith("--keep=")) {
      keep = parseNonNegativeInteger(arg.slice("--keep=".length), "--keep");
      continue;
    }
    if (arg.startsWith("--max-age-days=")) {
      maxAgeDays = parseNonNegativeNumber(
        arg.slice("--max-age-days=".length),
        "--max-age-days",
      );
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      printHelpAndExit(helpText);
    }
  }

  return { dryRun, keep, maxAgeDays };
}

export function selectByMaxAge(files, maxAgeDays) {
  if (maxAgeDays === null) {
    return files;
  }
  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
  const cutoff = Date.now() - maxAgeMs;
  return files.filter((file) => file.mtimeMs < cutoff);
}

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

export function sh(cmd) {
  return execSync(cmd, { encoding: "utf8" }).trim();
}

export function getLastTagVersion() {
  try {
    const tag = execSync("git describe --tags --abbrev=0 --match v*", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return tag.slice(1);
  } catch {
    return null;
  }
}

export function readPkgVersion() {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  return pkg.version;
}

export function writePkgVersion(version) {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  pkg.version = version;
  writeFileSync("package.json", `${JSON.stringify(pkg, null, 2)}\n`);
}

export function bumpPatch(version) {
  const [major, minor, patch] = version.split(".").map(Number);
  return `${major}.${minor}.${patch + 1}`;
}

export function compareVersions(a, b) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) {
      return pa[i] - pb[i];
    }
  }
  return 0;
}

export function nextReleaseVersion({ lastTagVersion, currentVersion }) {
  if (lastTagVersion === null) {
    if (currentVersion !== "1.0.0") {
      throw new Error(
        `First release requires package.json version 1.0.0, got ${currentVersion}`,
      );
    }
    return "1.0.0";
  }

  if (compareVersions(currentVersion, lastTagVersion) <= 0) {
    return bumpPatch(lastTagVersion);
  }

  return currentVersion;
}

export function assertReleaseReady({ lastTagVersion, currentVersion }) {
  if (lastTagVersion === null) {
    if (currentVersion !== "1.0.0") {
      throw new Error(
        `First release requires package.json version 1.0.0, got ${currentVersion}`,
      );
    }
    return;
  }

  if (compareVersions(currentVersion, lastTagVersion) <= 0) {
    throw new Error(
      `package.json version ${currentVersion} must be greater than latest tag v${lastTagVersion}. Run: pnpm version:bump`,
    );
  }
}

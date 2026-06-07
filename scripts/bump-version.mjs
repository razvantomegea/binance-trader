import {
  assertReleaseReady,
  getLastTagVersion,
  nextReleaseVersion,
  readPkgVersion,
  writePkgVersion,
} from "./lib/version.mjs";

const checkOnly = process.argv.includes("--check");
const lastTagVersion = getLastTagVersion();
const currentVersion = readPkgVersion();

if (checkOnly) {
  assertReleaseReady({ lastTagVersion, currentVersion });
  console.log(`Version ${currentVersion} is ready for release`);
  process.exit(0);
}

const nextVersion = nextReleaseVersion({ lastTagVersion, currentVersion });

if (nextVersion === currentVersion) {
  if (lastTagVersion === null) {
    console.log(
      `No release tags yet; ${currentVersion} is correct for first release (v1.0.0)`,
    );
  } else {
    console.log(`package.json already at ${currentVersion}`);
  }
  process.exit(0);
}

writePkgVersion(nextVersion);
console.log(`Bumped package.json: ${currentVersion} → ${nextVersion}`);

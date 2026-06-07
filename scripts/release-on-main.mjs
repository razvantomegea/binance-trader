import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const REPO = "razvantomegea/binance-trader";

function sh(cmd) {
  return execSync(cmd, { encoding: "utf8" }).trim();
}

const lastTag = (() => {
  try {
    return sh("git describe --tags --abbrev=0 --match v*");
  } catch {
    return null;
  }
})();

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
let newVersion;

if (lastTag === null) {
  newVersion = "1.0.0";
  if (pkg.version !== "1.0.0") {
    throw new Error(
      `First release requires package.json version 1.0.0, got ${pkg.version}`,
    );
  }
} else {
  const [major, minor, patch] = pkg.version.split(".").map(Number);
  newVersion = `${major}.${minor}.${patch + 1}`;
  pkg.version = newVersion;
  writeFileSync("package.json", `${JSON.stringify(pkg, null, 2)}\n`);
}

const tag = `v${newVersion}`;
const date = new Date().toISOString().slice(0, 10);

const logCmd =
  lastTag === null
    ? 'git log --pretty=format:"%s (%h)" --no-merges'
    : `git log ${lastTag}..HEAD --pretty=format:"%s (%h)" --no-merges`;
const rawLog = sh(logCmd);
const bullets = rawLog
  .split("\n")
  .filter(Boolean)
  .filter((line) => !line.startsWith("chore(release):"))
  .map((line) =>
    line.replace(/\(#(\d+)\)/, `([#$1](https://github.com/${REPO}/pull/$1))`),
  )
  .map((line) => `- ${line}`)
  .join("\n");

const section = `## [${newVersion}] - ${date}\n\n${bullets || "- Maintenance release"}\n\n`;

const changelog = readFileSync("CHANGELOG.md", "utf8");
const introLine = "Versions are auto-released on every merge to `main`.";
const introEnd = changelog.indexOf(introLine);
if (introEnd === -1) {
  throw new Error("CHANGELOG.md intro marker not found");
}
const insertAt = introEnd + introLine.length;
writeFileSync(
  "CHANGELOG.md",
  `${changelog.slice(0, insertAt).replace(/\n+$/, "")}\n\n${section}${changelog.slice(insertAt).replace(/^\n+/, "")}`,
);
writeFileSync("release-notes.md", section);

sh("git config user.name github-actions[bot]");
sh(
  "git config user.email 41898282+github-actions[bot]@users.noreply.github.com",
);

const filesToCommit =
  lastTag === null ? "CHANGELOG.md" : "package.json CHANGELOG.md";
sh(`git add ${filesToCommit}`);
sh(`git commit -m "chore(release): ${tag} [skip release]"`);
sh(`git tag ${tag}`);

let mainPushed = false;
let tagPushed = false;
try {
  sh("git push origin main");
  mainPushed = true;
  sh(`git push origin ${tag}`);
  tagPushed = true;
  sh(`gh release create ${tag} --title ${tag} --notes-file release-notes.md`);
} catch (error) {
  console.error("Release failed:", error.message ?? error);
  if (tagPushed) {
    try {
      sh(`git push --delete origin ${tag}`);
    } catch (cleanupError) {
      console.error(
        `Failed to delete remote tag ${tag}:`,
        cleanupError.message ?? cleanupError,
      );
    }
  }
  if (mainPushed) {
    try {
      sh("git reset --hard HEAD~1");
      sh("git push --force origin main");
    } catch (cleanupError) {
      console.error(
        "Failed to revert main push:",
        cleanupError.message ?? cleanupError,
      );
    }
  }
  try {
    sh(`git tag -d ${tag}`);
  } catch {
    // local tag may already be gone
  }
  throw error;
}

console.log(`Released ${tag}`);

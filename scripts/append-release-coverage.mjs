import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

function sh(cmd) {
  return execSync(cmd, { encoding: "utf8" }).trim();
}

const { version } = JSON.parse(readFileSync("package.json", "utf8"));
const tag = `v${version}`;

const lcovReportDir = join("coverage", "lcov-report");
if (!existsSync("coverage") || !existsSync(lcovReportDir)) {
  console.error(
    'error: "coverage" and "lcov-report" must exist before execSync can zip coverage',
  );
  process.exit(1);
}

execSync("zip -r coverage-report.zip lcov-report", {
  cwd: "coverage",
  stdio: "inherit",
});

sh(`gh release upload "${tag}" coverage/coverage-report.zip --clobber`);

const existingBody = sh(`gh release view "${tag}" --json body -q .body`);
const summary = sh("node scripts/coverage-release-summary.mjs");
const combined = `${existingBody.trim()}\n\n---\n\n${summary.trim()}\n`;
const notesPath = join(process.cwd(), "release-notes.md");
writeFileSync(notesPath, combined);
sh(`gh release edit "${tag}" --notes-file "${notesPath}"`);

console.log(`Attached coverage to ${tag}`);

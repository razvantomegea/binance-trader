import { readFileSync } from "node:fs";

const summary = JSON.parse(
  readFileSync("coverage/coverage-summary.json", "utf8"),
);
const { total } = summary;
const pct = (key) => `${total[key].pct}%`;

const markdown = [
  "## Test coverage",
  "",
  "| Metric | Coverage |",
  "|--------|----------|",
  `| Lines | ${pct("lines")} |`,
  `| Branches | ${pct("branches")} |`,
  `| Functions | ${pct("functions")} |`,
  `| Statements | ${pct("statements")} |`,
  "",
  "Download `coverage-report.zip` for the full HTML report.",
].join("\n");

process.stdout.write(markdown);

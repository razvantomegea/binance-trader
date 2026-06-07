import { execSync } from "node:child_process";

try {
  execSync("git config core.hooksPath .githooks", { stdio: "inherit" });
} catch {
  console.warn("Could not set git hooks path (not a git repo?)");
}

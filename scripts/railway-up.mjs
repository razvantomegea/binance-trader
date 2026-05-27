import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "dotenv";

const ENV_FILES = [".env.local", ".env"];

function getEnvValue(key) {
  const processValue = process.env[key]?.trim();
  if (processValue) {
    return processValue;
  }

  for (const filePath of ENV_FILES) {
    if (!existsSync(filePath)) {
      continue;
    }

    const parsed = parse(readFileSync(filePath, "utf8"));
    const fileValue = parsed[key]?.trim();
    if (fileValue) {
      return fileValue;
    }
  }

  return "";
}

const envKey = process.argv[2];

if (!envKey) {
  console.error("Missing env key argument.");
  console.error("Usage: node scripts/railway-up.mjs <ENV_KEY>");
  process.exit(1);
}

const service = getEnvValue(envKey);

if (!service) {
  console.error(`Missing required environment variable: ${envKey}`);
  process.exit(1);
}

const localRailwayBin = resolve(
  process.cwd(),
  "node_modules",
  "@railway",
  "cli",
  "bin",
  process.platform === "win32" ? "railway.exe" : "railway",
);

const railwayCommand = existsSync(localRailwayBin) ? localRailwayBin : "railway";
const railwayArgs = ["up", "--service", service];
const gitBashPath = "C:\\Program Files\\Git\\bin\\bash.exe";

function toPosixWindowsPath(pathValue) {
  return pathValue.replaceAll("\\", "/").replace(/^([A-Za-z]):/, "/$1");
}

try {
  if (process.platform === "win32") {
    if (existsSync(gitBashPath)) {
      const appData = process.env.APPDATA ?? "";
      const globalRailwayShim = resolve(appData, "npm", "railway");
      const bashRailwayCommand = existsSync(globalRailwayShim)
        ? toPosixWindowsPath(globalRailwayShim)
        : "railway";
      const posixCwd = toPosixWindowsPath(process.cwd());
      const escapedService = service.replaceAll('"', '\\"');
      execFileSync(
        gitBashPath,
        [
          "-lc",
          `cd "${posixCwd}" && "${bashRailwayCommand}" up --service "${escapedService}"`,
        ],
        { stdio: "inherit" },
      );
    } else {
      const appData = process.env.APPDATA ?? "";
      const globalRailwayCmd = resolve(appData, "npm", "railway.cmd");

      if (existsSync(globalRailwayCmd)) {
        const escapedCmd = globalRailwayCmd.replaceAll("'", "''");
        const escapedService = service.replaceAll("'", "''");
        execFileSync(
          "powershell.exe",
          [
            "-NoProfile",
            "-Command",
            `& '${escapedCmd}' up --service '${escapedService}'`,
          ],
          { stdio: "inherit" },
        );
      } else {
        execFileSync(railwayCommand, railwayArgs, { stdio: "inherit" });
      }
    }
  } else {
    execFileSync(railwayCommand, railwayArgs, { stdio: "inherit" });
  }
} catch (error) {
  const exitCode =
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof error.status === "number"
      ? error.status
      : 1;

  console.error(
    `Railway deploy failed for service "${service}" with exit code ${exitCode}.`,
  );
  process.exit(exitCode);
}

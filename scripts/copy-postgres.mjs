/**
 * One-shot copy of paper-trading tables from a source Postgres (e.g. Neon)
 * to a local target. Preserves serial IDs so positions.buy_trade_id stays valid.
 *
 * Usage:
 *   set SOURCE_DATABASE_URL=postgresql://...neon.../neondb?sslmode=require
 *   set TARGET_DATABASE_URL=postgresql://trading:trading@localhost:5432/trading
 *   node scripts/copy-postgres.mjs
 *   node scripts/copy-postgres.mjs --force
 *
 * Run `pnpm db:push` against TARGET first so the schema exists.
 * Use Neon's direct (non-pooled) connection string when possible.
 */

import postgres from "postgres";

const TABLES = [
  "trades",
  "positions",
  "equity_snapshots",
  "strategy_meta",
  "push_subscriptions",
];

const SERIAL_SEQUENCES = [
  { table: "trades", column: "id", sequence: "trades_id_seq" },
  {
    table: "equity_snapshots",
    column: "id",
    sequence: "equity_snapshots_id_seq",
  },
];

function parseArgs(argv) {
  return {
    force: argv.includes("--force"),
  };
}

function requireUrl(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`Missing ${name}. Set a postgresql:// connection string.`);
    process.exit(1);
  }
  return value;
}

/** Host/port/db/user identity; ignores query options such as sslmode. */
function connectionIdentity(urlString) {
  const url = new URL(urlString);
  const protocol = url.protocol === "postgres:" ? "postgresql:" : url.protocol;
  const host = url.hostname.toLowerCase();
  const port = url.port || "5432";
  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  const user = decodeURIComponent(url.username);
  return `${protocol}//${user}@${host}:${port}/${database}`;
}

function assertDistinctDatabases(sourceUrl, targetUrl) {
  if (connectionIdentity(sourceUrl) !== connectionIdentity(targetUrl)) {
    return;
  }
  console.error(
    "SOURCE_DATABASE_URL and TARGET_DATABASE_URL resolve to the same database.",
  );
  process.exit(1);
}

async function tableHasRows(sql, table) {
  const rows = await sql.unsafe(`SELECT 1 FROM ${table} LIMIT 1`);
  return rows.length > 0;
}

async function countRows(sql, table) {
  const [row] = await sql.unsafe(`SELECT COUNT(*)::int AS count FROM ${table}`);
  return row.count;
}

async function anyTableHasRows(sql) {
  for (const table of TABLES) {
    if (await tableHasRows(sql, table)) {
      return true;
    }
  }
  return false;
}

async function copyTable(source, target, table) {
  const rows = await source.unsafe(`SELECT * FROM ${table}`);
  if (rows.length === 0) {
    console.info(`[copy] ${table}: 0 rows`);
    return 0;
  }

  const columns = Object.keys(rows[0]);
  const columnList = columns.map((c) => `"${c}"`).join(", ");

  for (const row of rows) {
    const values = columns.map((c) => row[c]);
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");
    await target.unsafe(
      `INSERT INTO ${table} (${columnList}) VALUES (${placeholders})`,
      values,
    );
  }

  console.info(`[copy] ${table}: ${rows.length} rows`);
  return rows.length;
}

async function copyAllTables(source, target) {
  for (const table of TABLES) {
    await copyTable(source, target, table);
  }
}

async function resetSequences(target) {
  for (const { table, column, sequence } of SERIAL_SEQUENCES) {
    const [row] = await target.unsafe(
      `SELECT MAX(${column})::bigint AS max_id FROM ${table}`,
    );
    const maxId = row?.max_id;
    if (maxId == null) {
      await target.unsafe(`SELECT setval('${sequence}', 1, false)`);
    } else {
      await target.unsafe(`SELECT setval('${sequence}', ${maxId}, true)`);
    }
    console.info(`[copy] reset sequence ${sequence}`);
  }
}

async function logTargetCounts(target) {
  console.info("[copy] done. Target counts:");
  for (const table of TABLES) {
    const count = await countRows(target, table);
    console.info(`  ${table}: ${count}`);
  }
}

async function prepareTarget(target, force, targetNonEmpty) {
  if (!targetNonEmpty || !force) {
    return;
  }
  console.info("[copy] --force: truncating target tables");
  await target.unsafe(
    `TRUNCATE ${TABLES.join(", ")} RESTART IDENTITY CASCADE`,
  );
}

async function runCopy({ force, sourceUrl, targetUrl }) {
  assertDistinctDatabases(sourceUrl, targetUrl);

  const source = postgres(sourceUrl, { max: 1, idle_timeout: 5 });
  const target = postgres(targetUrl, { max: 1, idle_timeout: 5 });

  try {
    const targetNonEmpty = await anyTableHasRows(target);
    if (targetNonEmpty && !force) {
      console.error(
        "Target database already has rows. Re-run with --force to truncate and replace.",
      );
      process.exit(1);
    }

    await target.begin(async (tx) => {
      await prepareTarget(tx, force, targetNonEmpty);
      await copyAllTables(source, tx);
      await resetSequences(tx);
    });
    await logTargetCounts(target);
  } finally {
    await source.end({ timeout: 5 });
    await target.end({ timeout: 5 });
  }
}

async function main() {
  const { force } = parseArgs(process.argv.slice(2));
  await runCopy({
    force,
    sourceUrl: requireUrl("SOURCE_DATABASE_URL"),
    targetUrl: requireUrl("TARGET_DATABASE_URL"),
  });
}

main().catch((error) => {
  console.error("[copy] failed", error);
  process.exit(1);
});

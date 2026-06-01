# Binance Trading Dashboard

Next.js dashboard for **paper trading** USDT pairs on Binance spot data. A scheduled strategy scans hourly candles, simulates buys/sells against a virtual cash balance, and records trades, positions, and equity in Postgres.

> **Disclaimer:** This project is for education and experimentation only. It does not place real orders on Binance and is not financial advice. Use at your own risk.

## Features

- Portfolio summary, open positions, trade history, and equity curve
- Automated strategy (hourly interval) with configurable rules in `constants/binance.ts`
- Start/stop scheduler from the UI
- Optional web push notifications when trades execute
- Production scheduling via Railway cron or in-process cron for local dev

## Strategy

The strategy evaluates once per closed hourly candle (`H1`) and uses close prices for decisions.

- **Entry**:
  - 24h range must be at least +50% (`ENTRY_RANGE_PCT = 0.5`)
  - 24h range must not exceed +100% (`ENTRY_MAX_RANGE_PCT = 1`)
  - Current close must be within 10% of 24h high (`ENTRY_PULLBACK_PCT = EXIT_DRAWDOWN_PCT = 0.1`)
  - Position size is 5% of available cash (`BUY_NOTIONAL_PCT = 0.05`)

- **Exit**:
  - Trailing stop from peak after buy is 10% (`EXIT_DRAWDOWN_PCT = 0.1`)
  - Break-even lock: once price reaches at least +5% vs buy, stop floor is buy price (0% PnL floor)
  - Take profit remains +50% vs buy (`TAKE_PROFIT_PCT = 0.5`)

- **Re-entry cooldown**:
  - Symbol cooldown after sell is 24h (`SYMBOL_REENTRY_COOLDOWN_MS`)

## Stack

- [Next.js](https://nextjs.org/) 16 (App Router)
- [Drizzle ORM](https://orm.drizzle.team/) + Postgres (e.g. [Neon](https://neon.tech/))
- Binance public market data (`data-api.binance.vision` by default)
- [Vitest](https://vitest.dev/) for unit tests

## Prerequisites

- Node.js **≥ 20.9**
- [pnpm](https://pnpm.io/)
- A Postgres database URL

## Local development

1. Clone the repo and install dependencies:

   ```bash
   pnpm install
   ```

2. Create `.env.local` in the project root:

   ```env
   # Required
   DATABASE_URL=postgresql://...

   # Strategy scheduler (pick one approach)
   # A) In-process cron on `pnpm dev` / `pnpm start`:
   AUTO_START_STRATEGY=true
   # B) External cron (production-style); call /api/cron/run-strategy yourself:
   # SCHEDULER_MODE=external-cron
   # CRON_SECRET=generate-a-long-random-string

   # Optional — override Binance data API base URL
   # BINANCE_API_BASE_URL=https://data-api.binance.vision

   # Optional — web push (generate keys: npx web-push generate-vapid-keys)
   # WEB_PUSH_VAPID_PUBLIC_KEY=
   # WEB_PUSH_VAPID_PRIVATE_KEY=
   # WEB_PUSH_SUBJECT=mailto:you@example.com
   ```

3. Push the schema:

   ```bash
   pnpm db:push
   ```

4. Start the dev server:

   ```bash
   pnpm dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

### Scripts

| Command                       | Description                             |
| ----------------------------- | --------------------------------------- |
| `pnpm dev`                    | Next.js dev server                      |
| `pnpm build`                  | Production build                        |
| `pnpm start`                  | Production server                       |
| `pnpm lint`                   | Run ESLint                              |
| `pnpm lint:fix`               | Run ESLint with autofix                 |
| `pnpm test`                   | Run Vitest                              |
| `pnpm backtest`               | Run strategy backtest                   |
| `pnpm analyze:post-close`     | Analyze post-close 24h behavior         |
| `pnpm backtest:cleanup`       | Remove old backtest reports             |
| `pnpm backtest:cache:cleanup` | Remove backtest cache files             |
| `pnpm db:push`                | Apply Drizzle schema to `DATABASE_URL`  |
| `pnpm cron:trigger`           | Manually hit the strategy cron endpoint |

### Backtest analysis

Run a backtest and save a report:

```bash
pnpm backtest --days 180
```

Then analyze exits / TP / SL scenarios on a specific report:

```bash
python scripts/analyze-backtest-exits.py backtest-results/backtest-<timestamp>.json
```

### Manual cron trigger (local)

When using `SCHEDULER_MODE=external-cron`:

```bash
# Windows
set CRON_URL=http://localhost:3000/api/cron/run-strategy
set CRON_SECRET=your-secret
pnpm cron:trigger

# macOS / Linux
export CRON_URL=http://localhost:3000/api/cron/run-strategy
export CRON_SECRET=your-secret
pnpm cron:trigger
```

## Deployment (Railway)

The repo includes two [Railway](https://railway.com) config files for a common two-service setup:

| Service (example name) | Role                                       | Config file         |
| ---------------------- | ------------------------------------------ | ------------------- |
| Web app                | Next.js dashboard (always on)              | `railway.json`      |
| Cron worker            | Calls the strategy API every 15 min, exits | `railway.cron.json` |

### Web service

1. Connect the GitHub repo and deploy with `railway.json`.
2. Set variables (minimum):
   - `DATABASE_URL` — Postgres connection string
   - `SCHEDULER_MODE` = `external-cron`
   - `CRON_SECRET` — long random string; required for `/api/cron/run-strategy`
3. Add optional web push variables if you use notifications.

Do **not** set `AUTO_START_STRATEGY=true` when using external cron (avoids duplicate schedulers).

### Cron service

1. Add a second service in the same Railway project, same repo/branch.
2. **Settings → Config-as-code** → `railway.cron.json` (schedule: `*/5 * * * *`).
3. Variables (reference the web service by name in your project):
   - `CRON_SECRET` = `${{<web-service>.CRON_SECRET}}`
   - `CRON_URL` = `https://${{<web-service>.RAILWAY_PUBLIC_DOMAIN}}/api/cron/run-strategy`

Alternatively set `CRON_URL` explicitly to your public app URL.

### Verify

- Cron deployment logs should show a successful strategy run.
- On the dashboard, **Last run** updates after a successful trigger.

## Scheduler modes

| Mode       | Env                                            | Behavior                                                                   |
| ---------- | ---------------------------------------------- | -------------------------------------------------------------------------- |
| In-process | `AUTO_START_STRATEGY=true`                     | `node-cron` runs inside the Next.js server (handy locally)                 |
| External   | `SCHEDULER_MODE=external-cron` + `CRON_SECRET` | Strategy runs only when `/api/cron/run-strategy` is called with the secret |

## Environment reference

| Variable                     | Required          | Description                                   |
| ---------------------------- | ----------------- | --------------------------------------------- |
| `DATABASE_URL`               | Yes               | Postgres connection string                    |
| `CRON_SECRET`                | For external cron | Protects `/api/cron/run-strategy`             |
| `SCHEDULER_MODE`             | Production        | Set to `external-cron` with Railway cron      |
| `AUTO_START_STRATEGY`        | Local optional    | `true` to start in-process scheduler          |
| `BINANCE_API_BASE_URL`       | No                | Defaults to `https://data-api.binance.vision` |
| `WEB_PUSH_VAPID_PUBLIC_KEY`  | No                | Web push public key                           |
| `WEB_PUSH_VAPID_PRIVATE_KEY` | No                | Web push private key                          |
| `WEB_PUSH_SUBJECT`           | No                | `mailto:` or `https:` contact for VAPID       |
| `CRON_URL`                   | Cron worker only  | Full URL to `run-strategy` (cron service)     |

## License

No license file is included yet. If you fork or reuse this code, add a license that fits your intent.

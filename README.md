# Binance Trading Dashboard

Next.js app for paper trading and strategy automation.

## Local Development

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000`.

## Deployment (Railway)

You have **two services** in the same Railway project:

| Service | Purpose | Config file |
| --- | --- | --- |
| `binance-trading` | Next.js dashboard (always running) | `railway.json` |
| `strategy-cron` | Hits the cron API every 15 min, then exits | `railway.cron.json` |

### Step 1 — Push code to GitHub

Railway deploys from GitHub when you push to `main`:

```bash
git add railway.cron.json scripts/trigger-strategy-cron.mjs package.json README.md
git commit -m "Add Railway cron worker for strategy schedule"
git push origin main
```

After the push, Railway builds **both** services if they are connected to the repo (wait until each deployment shows **Success** in the dashboard).

### Step 2 — Web service (`binance-trading`)

You likely already have this. In [Railway](https://railway.com) → project **binance-trading** → service **binance-trading** → **Variables**, confirm:

- `SCHEDULER_MODE` = `external-cron`
- `CRON_SECRET` = (your secret; already set if cron worked before)

No extra deploy step if GitHub auto-deploy is on.

### Step 3 — Cron service (`strategy-cron`)

Open service **strategy-cron** (created in the same project). One-time setup:

1. **Settings** → **Source** — same GitHub repo as the web app, branch `main`.
2. **Settings** → **Config-as-code** → file path: `railway.cron.json`
3. **Variables** → add:
   - `CRON_SECRET` = `${{binance-trading.CRON_SECRET}}`
   - `CRON_URL` = `https://${{binance-trading.RAILWAY_PUBLIC_DOMAIN}}/api/cron/run-strategy`
4. **Settings** → **Cron schedule** should show `*/15 * * * *` (from `railway.cron.json`).
5. Click **Deploy** (or wait for the deploy from Step 1).

### Step 4 — Verify

1. **strategy-cron** → **Deployments** → open the latest run → logs should show `Strategy cron OK`.
2. Or use **Deploy** → **Run now** on `strategy-cron` to trigger immediately.
3. On the dashboard, **Last run** should update after a successful trigger.

### Local test (optional)

```bash
set CRON_URL=https://YOUR-APP.up.railway.app/api/cron/run-strategy
set CRON_SECRET=your-secret
pnpm cron:trigger
```

(On macOS/Linux use `export` instead of `set`.)

### Scheduler mode

- `SCHEDULER_MODE=external-cron` on the **web** service — strategy runs only when cron calls `/api/cron/run-strategy`.
- Do **not** use GitHub Actions for scheduling; Railway cron is the scheduler.

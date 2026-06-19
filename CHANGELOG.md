# Changelog

All notable changes are documented in [GitHub Releases](https://github.com/razvantomegea/binance-trader/releases).

Format based on [Keep a Changelog](https://keepachangelog.com/).

Versions are auto-released on every merge to `main`.

## [1.0.9] - 2026-06-19

- Refactor historical klines cache loading and instrumentation registration (4904c2f)
- Update ESLint configuration to include Prettier integration (3dbf35d)
- Refactor instrumentation tests and improve environment variable handling (42245bc)

## [1.0.8] - 2026-06-19

- Refactor dashboard polling implementation and introduce dedicated hook (03db451)
- Refactor dashboard polling mechanism to use configurable interval (c404acf)
- Update tar dependency version in package.json and pnpm-lock.yaml to 7.5.16 (f464a63)

## [1.0.7] - 2026-06-18

- Refactor chart components for improved layout and structure (0d02cab)
- Implement validation for trade and position markers (684103e)
- Enhance chart functionality with trade markers (28a97cd)
- Update entry range parameters and related tests (eb482ca)

## [1.0.6] - 2026-06-11

- Disable dashboard mutations in production ([#5](https://github.com/razvantomegea/binance-trader/pull/5)) (6740750)
- Update README.md (aaf4518)

## [1.0.5] - 2026-06-11

- Enhance strategy execution and agent guidelines (ab4e908)
- Refactor runStrategy to use batch processing for symbol evaluation (8496b58)

## [1.0.4] - 2026-06-11

- Add runStrategyBackfills function to streamline backfill execution (58779dd)
- Refine agent guidelines and improve error handling in strategy execution (76a30e6)

## [1.0.3] - 2026-06-07

- Implement conditional rendering for strategy toggle button based on environment (573501d)

## [1.0.2] - 2026-06-07

- Update README.md and version retrieval logic to clarify stable tag requirements (6a941f8)

## [1.0.1] - 2026-06-07

- Improve release workflow by ensuring tag fetching and enhancing version retrieval logic (4068d7f)
- Enhance release workflow by enabling tag fetching during checkout (348906c)
- Add null check for minPriceAfterClose24h in computePostClose24hExtrema tests (8f0314e)
- Update project dependencies, enhance testing setup, and improve ESLint configuration (ff8a330)

## [1.0.0] - 2026-06-07

- Refactor release workflow and enhance version validation (590c680)
- Update README.md to reflect new features and project structure (e25feed)
- Add version management scripts and setup git hooks (6fb07e6)
- Update project name and enhance changelog formatting (6569f8b)
- Remove CI workflow and enhance release process (fdc6151)
- Enhance release management scripts and coverage validation (1763f39)
- Update project configuration and enhance testing capabilities (9efc54c)
- Enhance Playwright integration and improve dashboard test coverage (a17abed)
- Update project configuration and dependencies (df8667f)
- Update pnpm-lock.yaml to reflect dependency version upgrades (f541372)
- Refactor dashboard data handling and improve backtest symbol validation (76d1b11)
- Refactor configuration files and improve code formatting (1a0414e)
- Update ESLint configuration, add Fallow for code health, and enhance project structure (6c7da8e)
- Enhance backtest cache configuration and add new file pattern check (5d4e294)
- Refactor backtest cache handling and improve configuration (f071b4f)
- Refactor CLI argument parsing for improved validation and introduce safe number utilities (4f78611)
- Enhance trading strategy with new parameters and decision logic (5058912)
- Fix typo in AGENTS.md regarding question-asking guideline for clarity and context (c6f5269)
- Update trading strategy parameters and documentation for entry conditions (8c06907)
- Rename exit reason to exit_drawdown_25pct_vs_peak ([#4](https://github.com/razvantomegea/binance-trader/pull/4)) (918fdf4)
- Split trailing stop (25%) from max loss cap (15%) ([#3](https://github.com/razvantomegea/binance-trader/pull/3)) (7eac008)
- Fix Max After Buy on SELL trades for accurate dashboard display ([#2](https://github.com/razvantomegea/binance-trader/pull/2)) (d9f2518)
- Add ZEC entry route for trading strategy evaluation ([#1](https://github.com/razvantomegea/binance-trader/pull/1)) (dcaf13c)
- Implement error handling for portfolio drawdown liquidation process (f7dfa79)
- Implement portfolio drawdown cap and enhance trading strategy logic (2d83ccf)
- Enhance ESLint configuration and refactor API routes for improved validation and error handling (a7ce82c)
- Refactor trading strategy logic to implement trailing stop and remove break-even lock (acbd7ee)
- Update cron schedule to every 5 minutes and adjust related constants and documentation (6f23563)
- Refactor backfillPostClose24hMetrics function to improve time eligibility checks (38075c4)
- Enhance Dashboard component with dynamic strategy description and new constants (2224aae)
- Update README formatting and improve database retry logic readability (db75bb8)
- Update trading strategy thresholds from 15% to 10% for drawdown and buy conditions (9c4ec69)
- Refactor database error handling and enhance retry logic (084b583)
- Update README and constants for trading strategy details and backtesting commands (fb08087)
- Refactor error handling in API routes and introduce database retry logic (317fa66)
- Implement post-close metrics for trades and enhance backtesting analysis (fd068ba)
- Enhance backtesting trade data structure with price metrics (af80277)
- Add ENTRY_MAX_RANGE_PCT constant and update decision logic for trading strategy (a7a3cf8)
- Refactor backtest configuration to standardize check interval (037464e)
- Refactor symbol handling in Dashboard and improve USDT symbol validation (588aa11)
- Implement USDT symbol validation across API and components (4cab607)
- Implement USDT symbol validation and normalization in backtest runner (5feec02)
- Enhance backtesting functionality with cache management and report cleanup scripts (199400f)
- Add backtesting functionality and related utilities for trading strategy evaluation (010b55e)
- Refactor trading strategy constants and evaluation logic for clarity and accuracy (67eba21)
- Refactor components for improved code readability and consistency (f10c9b8)
- Refactor dashboard components to use updated constant names for improved clarity (7d698b1)
- Refactor dashboard components for improved responsiveness and layout consistency (e801221)
- Refactor BaseAreaChart for responsive rendering and improve loading states (45f13af)
- Refactor portfolio summary calculations for accuracy and clarity (01f2bb1)
- Enhance portfolio summary and response structure to include detailed P&L metrics (1ba1c80)
- Enhance form input handling for iOS Safari to prevent auto-zoom (d0e7e84)
- Add close position API and integrate with dashboard for enhanced trading functionality (b4b7d9c)
- Enhance layout and styling across components for improved user experience (6e1b76c)
- Refactor dashboard layout and improve empty state handling in tables (28b7297)
- Update maxPriceAfterBuy handling in strategy evaluation and type definitions (4cec048)
- Add maxPriceAfterBuy field to positions and trades tables, and update related components (c0001b6)
- Refactor Content Security Policy in Next.js configuration for development environment support (2e52016)
- Add Railway CLI commands to package.json and implement railway-up script (135713d)
- Add Content Security Policy and refactor cron secret validation (75a5fe9)
- Refactor code for improved readability and consistency across multiple files, including updates to the README for service descriptions, adjustments to the dashboard component for better state management, and enhancements to test cases for clarity in strategy evaluation functions. (717c56d)
- Refactor dashboard and strategy heartbeat components to utilize new cron constants and compute next strategy run time. Update cron alert conditions for improved accuracy and clarity. (f210998)
- Enhance URL handling in resolveCronUrl function to ensure HTTPS is used consistently, improving security for cron job execution. (9dda994)
- Add Railway cron service for strategy execution, update README for deployment instructions, and refactor related components for improved clarity and functionality. (d26169f)
- Update cron schedule in fifteen-minute workflow to avoid peak delays by using an offset timing strategy. (47dbe84)
- Add 15-minute cron workflow for strategy execution and update dashboard components to support symbol selection and display next run time (8adc7b0)
- Update hourly cron schedule to run every 15 minutes instead of hourly for more frequent task execution. (35f4cf3)
- Update trade reason strings in evaluateSymbol function and related tests for consistency and clarity. (f7dd5fc)
- Add tests for evaluateSymbol function and update vitest configuration to include helper tests (bd96081)
- Remove Railway deployment script from package.json to streamline build process and reduce complexity. (1210eb2)
- Update BaseAreaChartProps to allow any data type for the data property, enhancing flexibility in data handling. (382ea64)
- Add BaseAreaChart component for reusable area chart functionality and refactor EquityCurve and PriceChart components to utilize it, improving code maintainability and reducing duplication. (cfc2b84)
- Add @railway/cli as a development dependency in package.json and update pnpm-lock.yaml to reflect the new version and dependencies. (a46f08c)
- Enhance error handling in placeTrade function by wrapping database operations in a try-catch block. Ensure proper deletion of trades on error and maintain existing logic for trade placement based on side. (783d112)
- Refactor trade placement logic in placeTrade function to improve error handling and database interaction. Simplify transaction management by removing explicit transaction context and adding error checks for trade insertion. Enhance position handling based on trade side. (3ed2d44)
- Refactor error handling in push notification API endpoints by introducing a utility function for error message retrieval. Update the VAPID public key handling to include normalization and validation. Enhance the push notification toggle component with improved error logging and debugging information. (501a008)
- Improve error handling in push notification API endpoints and enhance dashboard component with cron alert notifications. Refactor error logging and add utility functions for better error message retrieval. Update package.json to ensure proper formatting. (326d1a5)
- Enhance README with scheduler mode details and update push notification component to use a dedicated service worker registration function. Refactor strategy heartbeat logic to ensure state hydration and improve error handling during scheduler runs. (7c73223)
- Update deployment script in package.json to use 'deploy:railway' for Railway service deployment. (85fa214)
- Update project configuration for Railway deployment and enhance README. Remove Vercel-specific files, add Railway configuration, and update package.json with deployment scripts. Adjust .gitignore and improve dashboard component rendering. (8f3ca11)
- Remove existing Vercel cron configuration and add GitHub Actions workflow for hourly strategy execution. The new workflow triggers a cron job that calls the strategy API endpoint with necessary authorization checks. (e146f30)
- Refactor dashboard button disabling logic and update scheduler behavior. The strategy button is now disabled based on a combined condition of loading state and strategy action status. Adjusted the default return value in getSchedulerRunning to false when no value is found. (ffb75fe)
- Add Vercel cron configuration and enhance strategy API with authorization and scheduler management. Implement dynamic handling for cron job execution and improve error logging. Update dashboard data fetching to utilize new API endpoints. (47d806f)
- Add push notification functionality with API endpoints for subscription management. Implement service worker for handling push notifications and integrate with existing trading strategy components. Update package.json for new dependencies and add .prettierignore for formatting exclusions. (dbac4b4)
- Implement error handling for strategy API endpoints and add utility function for parsing finite numbers. Update .gitignore to exclude Vercel configuration files. (731b81b)
- Enhance strategy management with new API endpoints for starting, stopping, and checking the status of strategies. Update dashboard to display strategy status and integrate error handling for API responses. Refactor cron job to utilize a heartbeat mechanism for strategy execution. Update dependencies and improve error handling in various components. (e4f29c9)
- Add trading dashboard components including equity curve, portfolio summary, positions table, price chart, symbol list, and trades table. Implement data fetching and state management for real-time updates. (b82b1a8)
- Add initial configuration and API endpoints for trading dashboard (cbde7b3)
- initial setup (91b2e61)
- Initial commit from Create Next App (72d3bd2)

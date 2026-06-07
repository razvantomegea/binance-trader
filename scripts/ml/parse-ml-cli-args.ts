import { getTradingSymbols } from "@/utils/binance/get-usdt-symbols";

export interface MlCliBaseOptions {
  days: number;
  symbols?: string[];
  concurrency: number;
  feeBps: number;
}

interface ParseCliNumberParams {
  flag: string;
  value: string | undefined;
  integer?: boolean;
  min?: number;
  max?: number;
}

function assertFlagValue(flag: string, value: string | undefined): string {
  if (!value || value.trim().length === 0 || value.startsWith("--")) {
    throw new Error(`Missing value for ${flag}`);
  }
  return value;
}

function assertParsedNumber(
  value: string,
  flag: string,
  integer: boolean,
): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid numeric value for ${flag}: ${value}`);
  }
  if (integer && !Number.isInteger(parsed)) {
    throw new Error(`Invalid integer value for ${flag}: ${value}`);
  }
  return parsed;
}

function assertRange(params: {
  parsed: number;
  flag: string;
  value: string;
  min?: number;
  max?: number;
}): void {
  const { parsed, flag, value, min, max } = params;
  if (min !== undefined && parsed < min) {
    throw new Error(`Invalid value for ${flag}: ${value} must be >= ${min}`);
  }
  if (max !== undefined && parsed > max) {
    throw new Error(`Invalid value for ${flag}: ${value} must be <= ${max}`);
  }
}

export function parseCliNumber(params: ParseCliNumberParams): number {
  const { flag, value, integer = false, min, max } = params;
  const parsedValue = assertFlagValue(flag, value);
  const parsed = assertParsedNumber(parsedValue, flag, integer);
  assertRange({ parsed, flag, value: parsedValue, min, max });
  return parsed;
}

function parseSymbolList(value: string): string[] {
  return value
    .split(/[,\s]+/)
    .map((symbol) => symbol.trim().toUpperCase())
    .filter(Boolean);
}

export function parseMlBaseArgs(
  argv: string[],
  defaults: MlCliBaseOptions,
): MlCliBaseOptions {
  const options: MlCliBaseOptions = { ...defaults };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];

    if (arg === "--days") {
      options.days = parseCliNumber({
        flag: "--days",
        value: next,
        integer: true,
        min: 1,
      });
      i += 1;
      continue;
    }

    if (arg === "--symbols") {
      options.symbols = parseSymbolList(assertFlagValue("--symbols", next));
      i += 1;
      continue;
    }

    if (arg === "--concurrency") {
      options.concurrency = parseCliNumber({
        flag: "--concurrency",
        value: next,
        integer: true,
        min: 1,
      });
      i += 1;
      continue;
    }

    if (arg === "--fee-bps") {
      options.feeBps = parseCliNumber({
        flag: "--fee-bps",
        value: next,
        min: 0,
      });
      i += 1;
    }
  }

  return options;
}

export async function resolveSymbols(symbols?: string[]): Promise<string[]> {
  if (symbols && symbols.length > 0) {
    return [...new Set(symbols)].sort();
  }
  return [...(await getTradingSymbols())].sort();
}

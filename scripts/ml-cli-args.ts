export function parseCliNumber(params: {
  flag: string;
  value: string | undefined;
  integer?: boolean;
  min?: number;
  max?: number;
}): number {
  const { flag, value, integer = false, min, max } = params;

  if (!value || value.trim().length === 0 || value.startsWith("--")) {
    throw new Error(`Missing value for ${flag}`);
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid numeric value for ${flag}: ${value}`);
  }
  if (integer && !Number.isInteger(parsed)) {
    throw new Error(`Invalid integer value for ${flag}: ${value}`);
  }
  if (min !== undefined && parsed < min) {
    throw new Error(`Invalid value for ${flag}: ${value} must be >= ${min}`);
  }
  if (max !== undefined && parsed > max) {
    throw new Error(`Invalid value for ${flag}: ${value} must be <= ${max}`);
  }

  return parsed;
}

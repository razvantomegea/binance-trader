interface ParseBoundedIntParams {
  value: string | null;
  defaultValue: number;
  min: number;
  max: number;
}

export function parseBoundedInt({
  value,
  defaultValue,
  min,
  max,
}: ParseBoundedIntParams): number {
  const parsed = Number(value ?? String(defaultValue));
  const safe = Number.isFinite(parsed) ? parsed : defaultValue;
  return Math.min(Math.max(safe, min), max);
}

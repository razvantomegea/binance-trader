interface CompareToRefsParams {
  reference: number;
  refs: number[];
  thresholdPct: number;
}

interface GainWithinBandParams {
  value: number;
  ref: number;
  minPct: number;
  maxPct: number;
}

export function isGainWithinBand({
  value,
  ref,
  minPct,
  maxPct,
}: GainWithinBandParams): boolean {
  if (ref <= 0) return false;
  const gain = (value - ref) / ref;
  return gain >= minPct && gain <= maxPct;
}

export function hasGainVsAnyRef({
  reference,
  refs,
  thresholdPct,
}: CompareToRefsParams): boolean {
  return refs.some((ref) => ref > 0 && (reference - ref) / ref >= thresholdPct);
}

export function hasLossVsAnyRef({
  reference,
  refs,
  thresholdPct,
}: CompareToRefsParams): boolean {
  return refs.some(
    (ref) => ref > 0 && (reference - ref) / ref <= -thresholdPct,
  );
}

interface CompareToRefsParams {
  reference: number;
  refs: number[];
  thresholdPct: number;
}

export function hasGainVsAnyRef({
  reference,
  refs,
  thresholdPct,
}: CompareToRefsParams): boolean {
  return refs.some(
    (ref) => ref > 0 && (reference - ref) / ref >= thresholdPct,
  );
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

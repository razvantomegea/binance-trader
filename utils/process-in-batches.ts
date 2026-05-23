export async function processInBatches<T, R>({
  items,
  batchSize,
  processItem,
}: {
  items: T[];
  batchSize: number;
  processItem: (item: T) => Promise<R>;
}): Promise<R[]> {
  const results: R[] = [];

  for (let index = 0; index < items.length; index += batchSize) {
    const batch = items.slice(index, index + batchSize);
    const batchResults = await Promise.all(batch.map(processItem));
    results.push(...batchResults);
  }

  return results;
}

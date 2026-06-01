export function createAsyncMutex(): {
  run<T>(fn: () => Promise<T> | T): Promise<T>;
} {
  let chain: Promise<void> = Promise.resolve();

  return {
    run<T>(fn: () => Promise<T> | T): Promise<T> {
      const run = chain.then(() => fn());
      chain = run.then(
        () => undefined,
        () => undefined,
      );
      return run;
    },
  };
}

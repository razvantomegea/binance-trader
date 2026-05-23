export class InvalidSymbolsError extends Error {
  constructor(public readonly symbols: string[]) {
    super(`Unknown or inactive symbols: ${symbols.join(", ")}`);
    this.name = "InvalidSymbolsError";
  }
}

import { backfillMaxPriceAfterBuy } from "@/helpers/trades/backfill-max-price-after-buy";

let backfillPromise: Promise<void> | null = null;

export async function ensureMaxPriceAfterBuyBackfill(): Promise<void> {
  backfillPromise ??= backfillMaxPriceAfterBuy()
    .then(() => undefined)
    .catch((error) => {
      backfillPromise = null;
      console.error("Max-price-after-buy backfill failed:", error);
    });

  await backfillPromise;
}

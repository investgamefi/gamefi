'use client';

import { useEffect, useMemo, useState } from 'react';
import { Asset } from '@/types';
import { fetchQuotesBatch, applyLiveQuote, LiveQuote } from '@/lib/yahooFinance';

/**
 * Overlay live Yahoo quotes onto a list of assets. The input renders
 * immediately with whatever prices it carries (catalog/mock numbers);
 * one batched quote call refreshes the market-driven fields as soon as
 * it lands. Quotes cache for 5 minutes, so remounts are free.
 *
 * `refreshKey` lets callers force a refetch (e.g. a manual refresh
 * button) — bump the number to re-run.
 */
export function useLivePrices(
  assets: Asset[],
  refreshKey: number = 0,
): { assets: Asset[]; quotes: Map<string, LiveQuote>; isLive: boolean } {
  const [quotes, setQuotes] = useState<Map<string, LiveQuote>>(new Map());

  /* Key on the SET of symbols, not the array identity — most callers
     build the asset list in render, so identity changes every pass. */
  const symbolsKey = useMemo(
    () => [...new Set(assets.map((a) => a.symbol.toUpperCase()))].sort().join(','),
    [assets],
  );

  useEffect(() => {
    if (!symbolsKey) {
      setQuotes(new Map());
      return;
    }
    let cancelled = false;
    fetchQuotesBatch(symbolsKey.split(',')).then((fetched) => {
      if (!cancelled && fetched.size > 0) setQuotes(fetched);
    });
    return () => {
      cancelled = true;
    };
  }, [symbolsKey, refreshKey]);

  const liveAssets = useMemo(
    () => assets.map((a) => applyLiveQuote(a, quotes.get(a.symbol.toUpperCase()))),
    [assets, quotes],
  );

  return { assets: liveAssets, quotes, isLive: quotes.size > 0 };
}

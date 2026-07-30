'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Asset } from '@/types';
import { getAllAssets } from '@/data/assets';
import { searchAssetsFromYahoo, fetchAssetFromYahoo } from '@/lib/yahooFinance';

interface UseAssetSearchResult {
  results: Asset[];
  isLoading: boolean;
  error: string | null;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
}

const DEBOUNCE_DELAY = 300; // ms

/* Relevance rank for a search hit — lower is better.
   0 = exact symbol match ("MS" → MS the ticker)
   1 = symbol prefix match ("MS" → MSFT)
   2 = symbol substring match
   3 = company name match ("microsoft" → MSFT)
   4 = no match (Yahoo fuzzy hits whose text doesn't contain the query) */
export function assetSearchRank(asset: Pick<Asset, 'symbol' | 'name'>, query: string): number {
  const q = query.trim().toUpperCase();
  if (!q) return 4;
  const symbol = asset.symbol.toUpperCase();
  if (symbol === q) return 0;
  if (symbol.startsWith(q)) return 1;
  if (symbol.includes(q)) return 2;
  if (asset.name.toUpperCase().includes(q)) return 3;
  return 4;
}

function byRelevance(query: string) {
  return (a: Asset, b: Asset) =>
    assetSearchRank(a, query) - assetSearchRank(b, query) || a.symbol.localeCompare(b.symbol);
}

// Case-insensitive substring search over BOTH symbol and company name
function searchLocalAssets(query: string): Asset[] {
  const q = query.toUpperCase();
  return getAllAssets()
    .filter(a => a.symbol.toUpperCase().includes(q) || a.name.toUpperCase().includes(q))
    .sort(byRelevance(query));
}

/* Cap how many local hits we refresh per keystroke — a query like "a"
   matches half the catalog and we don't want dozens of quote calls.
   The per-symbol fetch has a 5-min cache + pending-request dedup, so
   repeat searches are free. */
const MAX_LOCAL_HYDRATE = 8;

/* Overlay live Yahoo price fields onto curated catalog entries. The
   catalog's hardcoded prices go stale (MU was showing its authored
   $84.56 while trading around $734) — but its sector/beta/PE metadata
   is richer than Yahoo's chart response, so we keep the local record
   and refresh only the market-driven numbers. Failed/zero quotes leave
   the local entry untouched rather than rendering $0.00. */
async function hydrateLocalResults(locals: Asset[]): Promise<Asset[]> {
  const head = await Promise.all(
    locals.slice(0, MAX_LOCAL_HYDRATE).map(async (local) => {
      const res = await fetchAssetFromYahoo(local.symbol);
      const live = res.success ? res.asset : undefined;
      if (!live || !(live.currentPrice > 0)) return local;
      return {
        ...local,
        currentPrice: live.currentPrice,
        previousClose: live.previousClose > 0 ? live.previousClose : local.previousClose,
        dayChange: live.dayChange,
        dayChangePercent: live.dayChangePercent,
        marketCap: live.marketCap > 0 ? live.marketCap : local.marketCap,
        weekHigh52: live.weekHigh52 > 0 ? live.weekHigh52 : local.weekHigh52,
        weekLow52: live.weekLow52 > 0 ? live.weekLow52 : local.weekLow52,
      };
    })
  );
  return [...head, ...locals.slice(MAX_LOCAL_HYDRATE)];
}

export function useAssetSearch(initialTerm: string = ''): UseAssetSearchResult {
  const [searchTerm, setSearchTerm] = useState(initialTerm);
  const [results, setResults] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track the latest search to avoid race conditions
  const latestSearchRef = useRef<string>('');
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const performSearch = useCallback(async (term: string) => {
    const normalizedTerm = term.trim();
    latestSearchRef.current = normalizedTerm;

    // Clear previous error
    setError(null);

    // If empty search, return empty results
    if (!normalizedTerm) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    // Local matches (symbol OR company name) render immediately with
    // catalog prices; live quotes overlay them as soon as they arrive.
    const localResults = searchLocalAssets(normalizedTerm);
    setResults(localResults);

    // Exact local ticker hit — skip the remote *search*, but still
    // refresh the local hits' prices. (This early return used to skip
    // hydration entirely, which is why catalog tickers like MU showed
    // their stale authored price forever.)
    const hasExactLocalMatch = localResults.some(
      a => a.symbol.toUpperCase() === normalizedTerm.toUpperCase()
    );
    if (hasExactLocalMatch) {
      setIsLoading(false);
      try {
        const hydrated = await hydrateLocalResults(localResults);
        if (latestSearchRef.current === normalizedTerm) setResults(hydrated);
      } catch {
        /* keep catalog prices on failure */
      }
      return;
    }

    // Only block the list with a spinner when there is nothing local to
    // show; otherwise Yahoo results merge in silently when they arrive.
    setIsLoading(localResults.length === 0);

    try {
      // Live-price refresh for local hits and the Yahoo name/ticker
      // search run concurrently ("microsoft" → MSFT).
      const [hydratedLocals, yahooResponse] = await Promise.all([
        hydrateLocalResults(localResults).catch(() => localResults),
        searchAssetsFromYahoo(normalizedTerm),
      ]);

      // Check if search term has changed while we were fetching
      if (latestSearchRef.current !== normalizedTerm) return;

      const localSymbols = new Set(localResults.map(a => a.symbol.toUpperCase()));
      const merged = [
        ...hydratedLocals,
        /* Drop remote results whose quote hydration failed (price 0) —
           a $0.00 row with a Sign button reads as broken and would
           corrupt portfolio math if signed. */
        ...yahooResponse.assets.filter(
          a => !localSymbols.has(a.symbol.toUpperCase()) && a.currentPrice > 0
        ),
      ].sort(byRelevance(normalizedTerm));

      setResults(merged);

      if (
        merged.length === 0 &&
        yahooResponse.error &&
        yahooResponse.error !== 'Symbol not found'
      ) {
        setError(yahooResponse.error);
      }
    } catch {
      if (latestSearchRef.current === normalizedTerm) {
        if (localResults.length === 0) {
          setError('Failed to search assets');
        }
      }
    } finally {
      if (latestSearchRef.current === normalizedTerm) {
        setIsLoading(false);
      }
    }
  }, []);

  // Debounced search effect
  useEffect(() => {
    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new timer
    debounceTimerRef.current = setTimeout(() => {
      performSearch(searchTerm);
    }, DEBOUNCE_DELAY);

    // Cleanup
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchTerm, performSearch]);

  return {
    results,
    isLoading,
    error,
    searchTerm,
    setSearchTerm,
  };
}

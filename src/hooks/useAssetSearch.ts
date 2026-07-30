'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Asset } from '@/types';
import { getAllAssets } from '@/data/assets';
import { searchAssetsFromYahoo } from '@/lib/yahooFinance';

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

    // Local matches (symbol OR company name) render immediately.
    const localResults = searchLocalAssets(normalizedTerm);
    setResults(localResults);

    // Exact local ticker hit — no need to go remote.
    const hasExactLocalMatch = localResults.some(
      a => a.symbol.toUpperCase() === normalizedTerm.toUpperCase()
    );
    if (hasExactLocalMatch) {
      setIsLoading(false);
      return;
    }

    // Only block the list with a spinner when there is nothing local to
    // show; otherwise Yahoo results merge in silently when they arrive.
    setIsLoading(localResults.length === 0);

    try {
      // Yahoo search matches by ticker AND company name ("microsoft" → MSFT)
      const yahooResponse = await searchAssetsFromYahoo(normalizedTerm);

      // Check if search term has changed while we were fetching
      if (latestSearchRef.current !== normalizedTerm) return;

      const localSymbols = new Set(localResults.map(a => a.symbol.toUpperCase()));
      const merged = [
        ...localResults,
        ...yahooResponse.assets.filter(a => !localSymbols.has(a.symbol.toUpperCase())),
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

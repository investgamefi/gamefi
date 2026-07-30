import { Asset } from '@/types';

interface YahooFinanceResponse {
  success: boolean;
  asset?: Asset;
  error?: string;
}

interface CacheEntry {
  asset: Asset;
  timestamp: number;
}

// In-memory cache with 5-minute expiration
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds
const memoryCache: Map<string, CacheEntry> = new Map();

// Pending requests to prevent duplicate API calls
const pendingRequests: Map<string, Promise<YahooFinanceResponse>> = new Map();

// LocalStorage key for session persistence
const STORAGE_KEY = 'gamefi-yahoo-cache';

function getFromLocalStorage(symbol: string): Asset | null {
  if (typeof window === 'undefined') return null;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    const cache: Record<string, CacheEntry> = JSON.parse(stored);
    const entry = cache[symbol.toUpperCase()];

    if (entry && Date.now() - entry.timestamp < CACHE_DURATION) {
      return entry.asset;
    }
  } catch {
    // Ignore parsing errors
  }

  return null;
}

function saveToLocalStorage(symbol: string, asset: Asset): void {
  if (typeof window === 'undefined') return;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const cache: Record<string, CacheEntry> = stored ? JSON.parse(stored) : {};

    cache[symbol.toUpperCase()] = {
      asset,
      timestamp: Date.now(),
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore storage errors
  }
}

function getFromMemoryCache(symbol: string): Asset | null {
  const entry = memoryCache.get(symbol.toUpperCase());

  if (entry && Date.now() - entry.timestamp < CACHE_DURATION) {
    return entry.asset;
  }

  // Clean up expired entry
  if (entry) {
    memoryCache.delete(symbol.toUpperCase());
  }

  return null;
}

function saveToMemoryCache(symbol: string, asset: Asset): void {
  memoryCache.set(symbol.toUpperCase(), {
    asset,
    timestamp: Date.now(),
  });
}

export async function fetchAssetFromYahoo(symbol: string): Promise<YahooFinanceResponse> {
  const normalizedSymbol = symbol.toUpperCase();

  // Check memory cache first
  const memoryCached = getFromMemoryCache(normalizedSymbol);
  if (memoryCached) {
    return { success: true, asset: memoryCached };
  }

  // Check localStorage cache
  const localCached = getFromLocalStorage(normalizedSymbol);
  if (localCached) {
    // Also save to memory cache for faster access
    saveToMemoryCache(normalizedSymbol, localCached);
    return { success: true, asset: localCached };
  }

  // Check if there's already a pending request for this symbol
  const pending = pendingRequests.get(normalizedSymbol);
  if (pending) {
    return pending;
  }

  // Create new request
  const request = (async (): Promise<YahooFinanceResponse> => {
    try {
      const response = await fetch(`/api/yahoo-finance?symbol=${encodeURIComponent(normalizedSymbol)}`);
      const data: YahooFinanceResponse = await response.json();

      if (data.success && data.asset) {
        // Cache the result
        saveToMemoryCache(normalizedSymbol, data.asset);
        saveToLocalStorage(normalizedSymbol, data.asset);
      }

      return data;
    } catch (error) {
      console.error('Error fetching from Yahoo Finance:', error);
      return { success: false, error: 'Network error' };
    } finally {
      // Clean up pending request
      pendingRequests.delete(normalizedSymbol);
    }
  })();

  // Store the pending request
  pendingRequests.set(normalizedSymbol, request);

  return request;
}

interface SearchCandidate {
  symbol: string;
  name: string;
}

interface YahooSearchAssetsResult {
  success: boolean;
  assets: Asset[];
  error?: string;
}

// Query → candidate list cache (same 5-minute TTL as the quote cache)
const searchCandidateCache: Map<string, { candidates: SearchCandidate[]; timestamp: number }> =
  new Map();

async function fetchSearchCandidates(
  query: string
): Promise<{ candidates: SearchCandidate[]; error?: string }> {
  const key = query.toUpperCase();
  const cached = searchCandidateCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return { candidates: cached.candidates };
  }

  try {
    const response = await fetch(`/api/yahoo-finance?q=${encodeURIComponent(query)}`);
    const data: { success: boolean; candidates?: SearchCandidate[]; error?: string } =
      await response.json();

    if (!data.success) {
      return { candidates: [], error: data.error || 'Search failed' };
    }

    const candidates = data.candidates ?? [];
    searchCandidateCache.set(key, { candidates, timestamp: Date.now() });
    return { candidates };
  } catch {
    return { candidates: [], error: 'Network error' };
  }
}

/**
 * Search Yahoo Finance by ticker OR company name ("microsoft" → MSFT).
 * Resolves candidate tickers from Yahoo's autocomplete endpoint, then
 * hydrates each one through the cached quote fetch so results carry
 * live prices in the app's Asset shape.
 */
export async function searchAssetsFromYahoo(
  query: string,
  limit: number = 6
): Promise<YahooSearchAssetsResult> {
  const { candidates, error } = await fetchSearchCandidates(query);

  // Fallback: preserve the old direct-ticker validation path for
  // symbol-like terms the search endpoint missed.
  if (candidates.length === 0 && /^[A-Za-z0-9.\-]{1,10}$/.test(query)) {
    const direct = await fetchAssetFromYahoo(query);
    if (direct.success && direct.asset) {
      return { success: true, assets: [direct.asset] };
    }
    return { success: false, assets: [], error: error || direct.error };
  }

  const resolved = await Promise.all(
    candidates.slice(0, limit).map(async (candidate) => {
      const res = await fetchAssetFromYahoo(candidate.symbol);
      if (!res.success || !res.asset) return null;
      // Chart API sometimes lacks a display name — use the search result's.
      if ((!res.asset.name || res.asset.name === res.asset.symbol) && candidate.name) {
        return { ...res.asset, name: candidate.name };
      }
      return res.asset;
    })
  );

  const assets = resolved.filter((a): a is Asset => a !== null);
  return { success: true, assets, error: assets.length === 0 ? error : undefined };
}

// Clear all cached data
export function clearYahooCache(): void {
  memoryCache.clear();
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY);
  }
}

// Get all cached assets (from localStorage)
export function getCachedAssets(): Asset[] {
  if (typeof window === 'undefined') return [];

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];

    const cache: Record<string, CacheEntry> = JSON.parse(stored);
    const now = Date.now();

    return Object.values(cache)
      .filter(entry => now - entry.timestamp < CACHE_DURATION)
      .map(entry => entry.asset);
  } catch {
    return [];
  }
}

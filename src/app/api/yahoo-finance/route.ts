import { NextRequest, NextResponse } from 'next/server';
import { Asset, AssetType } from '@/types';

interface YahooChartMeta {
  currency: string;
  symbol: string;
  instrumentType: string;
  regularMarketPrice: number;
  chartPreviousClose: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  regularMarketDayHigh: number;
  regularMarketDayLow: number;
  regularMarketVolume: number;
  longName?: string;
  shortName?: string;
}

interface YahooChartResponse {
  chart: {
    result: Array<{
      meta: YahooChartMeta;
    }> | null;
    error: null | { code: string; description: string };
  };
}

interface YahooSearchQuote {
  symbol?: string;
  shortname?: string;
  longname?: string;
  quoteType?: string;
}

interface YahooSearchApiResponse {
  quotes?: YahooSearchQuote[];
}

function mapInstrumentTypeToAssetType(instrumentType?: string): AssetType {
  switch (instrumentType?.toUpperCase()) {
    case 'EQUITY':
      return 'stock';
    case 'ETF':
      return 'etf';
    case 'MUTUALFUND':
      return 'etf';
    default:
      return 'stock';
  }
}

function mapChartToAsset(meta: YahooChartMeta): Asset {
  const currentPrice = meta.regularMarketPrice || 0;
  const previousClose = meta.chartPreviousClose || 0;
  const dayChange = currentPrice - previousClose;
  const dayChangePercent = previousClose > 0 ? (dayChange / previousClose) * 100 : 0;

  return {
    id: meta.symbol.toLowerCase(),
    symbol: meta.symbol.toUpperCase(),
    name: meta.longName || meta.shortName || meta.symbol,
    type: mapInstrumentTypeToAssetType(meta.instrumentType),
    sector: 'Other', // Chart API doesn't provide sector
    currentPrice,
    previousClose,
    dayChange,
    dayChangePercent,
    marketCap: 0, // Not available in chart API
    beta: 1.0, // Not available in chart API
    peRatio: null, // Not available in chart API
    dividendYield: 0, // Not available in chart API
    weekHigh52: meta.fiftyTwoWeekHigh || 0,
    weekLow52: meta.fiftyTwoWeekLow || 0,
  };
}

/* Light per-symbol quote used by the ?symbols= batch mode. Spark's
   meta is the same shape as the chart API's, but sector/beta/PE never
   come back from either — batch consumers overlay these numbers onto
   assets they already have. Mirrored as LiveQuote in lib/yahooFinance
   (route files may only export route handlers). */
interface LiveQuote {
  symbol: string;
  currentPrice: number;
  previousClose: number;
  dayChange: number;
  dayChangePercent: number;
  weekHigh52: number;
  weekLow52: number;
  /* From the v7 quote endpoint; 0 when only spark data was available
     (spark carries no cap) — consumers keep their existing value. */
  marketCap: number;
}

const YAHOO_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/* ---- Cookie + crumb handshake for the v7 quote endpoint ----
   Since 2023 Yahoo's quote API rejects anonymous calls with 401
   "Invalid Crumb". The dance: hit fc.yahoo.com to receive a session
   cookie, then exchange it at /v1/test/getcrumb for a crumb token,
   then pass BOTH on quote calls. Cached ~30 min; a 401/403 on a quote
   call clears the cache so the next request re-handshakes. */
const CRUMB_TTL = 30 * 60 * 1000;
let crumbState: { cookie: string; crumb: string; timestamp: number } | null = null;

async function getYahooAuth(): Promise<{ cookie: string; crumb: string } | null> {
  if (crumbState && Date.now() - crumbState.timestamp < CRUMB_TTL) {
    return crumbState;
  }
  try {
    const cookieRes = await fetch('https://fc.yahoo.com', {
      headers: { 'User-Agent': YAHOO_UA },
      cache: 'no-store',
      redirect: 'manual',
    });
    /* Node's undici exposes getSetCookie(); guard for older runtimes. */
    const rawCookies: string[] =
      typeof cookieRes.headers.getSetCookie === 'function'
        ? cookieRes.headers.getSetCookie()
        : cookieRes.headers.get('set-cookie')
        ? [cookieRes.headers.get('set-cookie')!]
        : [];
    const cookie = rawCookies.map((c) => c.split(';')[0].trim()).filter(Boolean).join('; ');
    if (!cookie) return null;

    const crumbRes = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', {
      headers: { 'User-Agent': YAHOO_UA, Cookie: cookie },
      cache: 'no-store',
    });
    if (!crumbRes.ok) return null;
    const crumb = (await crumbRes.text()).trim();
    if (!crumb || crumb.includes('<')) return null;

    crumbState = { cookie, crumb, timestamp: Date.now() };
    return crumbState;
  } catch (error) {
    console.error('Yahoo crumb handshake failed:', error);
    return null;
  }
}

interface YahooV7Quote {
  symbol?: string;
  regularMarketPrice?: number;
  regularMarketPreviousClose?: number;
  regularMarketChange?: number;
  regularMarketChangePercent?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  marketCap?: number;
}

const V7_CHUNK_SIZE = 60;

/* Primary batch source: v7 quote — one call per 60 tickers, carries
   marketCap + 52-week range on top of price/day-change. Returns null
   when auth or the call fails so the caller can fall back to spark. */
async function fetchQuoteChunkV7(symbols: string[]): Promise<LiveQuote[] | null> {
  const auth = await getYahooAuth();
  if (!auth) return null;
  try {
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols.join(','))}&crumb=${encodeURIComponent(auth.crumb)}`;
    const response = await fetch(url, {
      headers: { 'User-Agent': YAHOO_UA, Cookie: auth.cookie },
      cache: 'no-store',
    });
    if (response.status === 401 || response.status === 403) {
      crumbState = null; // stale crumb — force re-handshake next call
      return null;
    }
    if (!response.ok) return null;
    const data: { quoteResponse?: { result?: YahooV7Quote[] | null } } = await response.json();
    const quotes: LiveQuote[] = [];
    for (const q of data.quoteResponse?.result ?? []) {
      const currentPrice = q.regularMarketPrice || 0;
      if (!q.symbol || !(currentPrice > 0)) continue;
      const previousClose = q.regularMarketPreviousClose || 0;
      quotes.push({
        symbol: q.symbol.toUpperCase(),
        currentPrice,
        previousClose,
        dayChange:
          q.regularMarketChange ?? (previousClose > 0 ? currentPrice - previousClose : 0),
        dayChangePercent:
          q.regularMarketChangePercent ??
          (previousClose > 0 ? ((currentPrice - previousClose) / previousClose) * 100 : 0),
        weekHigh52: q.fiftyTwoWeekHigh || 0,
        weekLow52: q.fiftyTwoWeekLow || 0,
        marketCap: q.marketCap || 0,
      });
    }
    return quotes;
  } catch (error) {
    console.error('Yahoo v7 quote batch failed:', error);
    return null;
  }
}

/* Spark's real response is a FLAT object keyed by symbol (verified
   against the live endpoint — not the nested spark.result shape some
   docs describe):
     { "MU": { "symbol": "MU", "close": [739.0],
               "chartPreviousClose": 820.53, ... }, ... }
   No 52-week data here; weekHigh52/weekLow52 stay 0 and consumers
   keep their existing values for those fields. */
interface YahooSparkEntry {
  symbol?: string;
  close?: Array<number | null> | null;
  chartPreviousClose?: number | null;
}

const SPARK_CHUNK_SIZE = 20;
const BATCH_MAX_SYMBOLS = 120;

function sparkEntryToLiveQuote(symbol: string, entry: YahooSparkEntry): LiveQuote | null {
  const closes = (entry.close ?? []).filter((c): c is number => typeof c === 'number' && c > 0);
  const currentPrice = closes.length > 0 ? closes[closes.length - 1] : 0;
  if (!(currentPrice > 0)) return null;
  const previousClose = entry.chartPreviousClose || 0;
  const dayChange = previousClose > 0 ? currentPrice - previousClose : 0;
  const dayChangePercent = previousClose > 0 ? (dayChange / previousClose) * 100 : 0;
  return {
    symbol: symbol.toUpperCase(),
    currentPrice,
    previousClose,
    dayChange,
    dayChangePercent,
    weekHigh52: 0,
    weekLow52: 0,
    marketCap: 0,
  };
}

async function fetchSparkChunk(symbols: string[]): Promise<LiveQuote[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/spark?symbols=${encodeURIComponent(symbols.join(','))}&range=1d&interval=1d`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
    cache: 'no-store',
  });
  if (!response.ok) {
    console.error(`Yahoo spark API returned ${response.status} for chunk of ${symbols.length}`);
    return [];
  }
  const data: Record<string, YahooSparkEntry> = await response.json();
  const quotes: LiveQuote[] = [];
  for (const [symbol, entry] of Object.entries(data)) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const quote = sparkEntryToLiveQuote(entry.symbol || symbol, entry);
    if (quote) quotes.push(quote);
  }
  return quotes;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const symbol = searchParams.get('symbol');
  const query = searchParams.get('q');
  const symbolsParam = searchParams.get('symbols');

  /* Batch quote mode: ?symbols=MU,MSFT,NVDA → { quotes: { MU: {...} } }.
     One spark request per 20 tickers instead of one chart request per
     ticker, so the market page can refresh its whole catalog in a
     couple of upstream calls. Unresolvable symbols are simply absent
     from the map — callers keep their existing numbers for those. */
  if (symbolsParam !== null) {
    const symbolRegexBatch = /^[A-Za-z0-9.\-^=]{1,12}$/;
    const symbols = [
      ...new Set(
        symbolsParam
          .split(',')
          .map((s) => s.trim().toUpperCase())
          .filter((s) => s && symbolRegexBatch.test(s)),
      ),
    ];
    if (symbols.length === 0) {
      return NextResponse.json({ success: true, quotes: {} });
    }
    if (symbols.length > BATCH_MAX_SYMBOLS) {
      return NextResponse.json(
        { success: false, error: `Too many symbols (max ${BATCH_MAX_SYMBOLS})` },
        { status: 400 },
      );
    }
    try {
      /* Primary: v7 quote (marketCap + 52-week range). Fallback: spark
         (price/day-change only) when the crumb handshake or any quote
         chunk fails — degraded but never empty because of auth. */
      const v7Chunks: string[][] = [];
      for (let i = 0; i < symbols.length; i += V7_CHUNK_SIZE) {
        v7Chunks.push(symbols.slice(i, i + V7_CHUNK_SIZE));
      }
      const v7Results = await Promise.all(v7Chunks.map(fetchQuoteChunkV7));

      let allQuotes: LiveQuote[];
      if (v7Results.every((r): r is LiveQuote[] => r !== null)) {
        allQuotes = v7Results.flat();
      } else {
        const sparkChunks: string[][] = [];
        for (let i = 0; i < symbols.length; i += SPARK_CHUNK_SIZE) {
          sparkChunks.push(symbols.slice(i, i + SPARK_CHUNK_SIZE));
        }
        allQuotes = (await Promise.all(sparkChunks.map(fetchSparkChunk))).flat();
      }

      const quotes: Record<string, LiveQuote> = {};
      for (const quote of allQuotes) {
        quotes[quote.symbol] = quote;
      }
      return NextResponse.json({ success: true, quotes });
    } catch (error) {
      console.error('Yahoo batch quote error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch batch quotes' },
        { status: 500 },
      );
    }
  }

  /* Name/ticker search mode: ?q=microsoft → candidate tickers.
     Yahoo's autocomplete endpoint matches by company name natively,
     so "microsoft" resolves to MSFT. The frontend then hydrates each
     candidate through the existing ?symbol= quote path. */
  if (query !== null) {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length > 50) {
      return NextResponse.json(
        { success: false, error: 'Invalid search query' },
        { status: 400 }
      );
    }

    try {
      const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(trimmed)}&quotesCount=10&newsCount=0&listsCount=0`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        cache: 'no-store',
      });

      if (!response.ok) {
        console.error(`Yahoo Finance search API returned ${response.status}`);
        return NextResponse.json(
          { success: false, error: 'Search failed' },
          { status: 502 }
        );
      }

      const data: YahooSearchApiResponse = await response.json();
      const allowedTypes = new Set(['EQUITY', 'ETF', 'MUTUALFUND']);
      const candidates = (data.quotes ?? [])
        .filter((q) => q.symbol && allowedTypes.has((q.quoteType ?? '').toUpperCase()))
        .slice(0, 8)
        .map((q) => ({
          symbol: q.symbol!.toUpperCase(),
          name: q.longname || q.shortname || q.symbol!,
        }));

      return NextResponse.json({ success: true, candidates });
    } catch (error) {
      console.error('Yahoo Finance search API error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to search Yahoo Finance' },
        { status: 500 }
      );
    }
  }

  if (!symbol) {
    return NextResponse.json(
      { success: false, error: 'Symbol parameter is required' },
      { status: 400 }
    );
  }

  // Validate symbol format (alphanumeric, 1-10 characters, may include dots and dashes)
  const symbolRegex = /^[A-Za-z0-9.\-]{1,10}$/;
  if (!symbolRegex.test(symbol)) {
    return NextResponse.json(
      { success: false, error: 'Invalid symbol format' },
      { status: 400 }
    );
  }

  try {
    const upperSymbol = symbol.toUpperCase();
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(upperSymbol)}?interval=1d&range=1d`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      console.error(`Yahoo Finance API returned ${response.status}`);
      return NextResponse.json(
        { success: false, error: 'Symbol not found' },
        { status: 404 }
      );
    }

    const data: YahooChartResponse = await response.json();

    if (data.chart.error) {
      console.error('Yahoo Finance API error:', data.chart.error);
      return NextResponse.json(
        { success: false, error: data.chart.error.description || 'Symbol not found' },
        { status: 404 }
      );
    }

    if (!data.chart.result || data.chart.result.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Symbol not found' },
        { status: 404 }
      );
    }

    const meta = data.chart.result[0].meta;

    // Allow price = 0 for inactive/delisted tickers, only reject if undefined
    if (meta.regularMarketPrice === undefined || meta.regularMarketPrice === null) {
      return NextResponse.json(
        { success: false, error: 'No price data available for this symbol' },
        { status: 404 }
      );
    }

    const asset = mapChartToAsset(meta);

    /* Chart API never returns marketCap, so Yahoo-sourced search rows
       used to render $0.00 in the CAP column. Enrich from the v7 quote
       when auth is available; on failure the asset ships as-is. */
    const v7 = await fetchQuoteChunkV7([upperSymbol]);
    const quote = v7?.[0];
    if (quote) {
      asset.marketCap = quote.marketCap > 0 ? quote.marketCap : asset.marketCap;
      asset.weekHigh52 = quote.weekHigh52 > 0 ? quote.weekHigh52 : asset.weekHigh52;
      asset.weekLow52 = quote.weekLow52 > 0 ? quote.weekLow52 : asset.weekLow52;
    }

    return NextResponse.json({ success: true, asset });
  } catch (error) {
    console.error('Yahoo Finance API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch data from Yahoo Finance' },
      { status: 500 }
    );
  }
}

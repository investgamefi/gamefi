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

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const symbol = searchParams.get('symbol');
  const query = searchParams.get('q');

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
    return NextResponse.json({ success: true, asset });
  } catch (error) {
    console.error('Yahoo Finance API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch data from Yahoo Finance' },
      { status: 500 }
    );
  }
}

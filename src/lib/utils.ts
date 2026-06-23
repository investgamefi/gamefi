import { Portfolio, PortfolioPerformance, Asset, LeaderboardEntry, User, PortfolioPlayer } from '@/types';
import { format, subDays, subMonths, subYears } from 'date-fns';
import { portfolioStorage, userStorage } from './storage';

export const cn = (...classes: (string | boolean | undefined | null | number)[]): string => {
  return classes.filter((c) => typeof c === 'string' && c.length > 0).join(' ');
};

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

export const formatNumber = (num: number): string => {
  if (num >= 1e12) return `${(num / 1e12).toFixed(2)}T`;
  if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
  return num.toFixed(2);
};

export const formatPercent = (value: number, showSign = true): string => {
  const sign = showSign && value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
};

export const formatDate = (date: string | Date): string => {
  return format(new Date(date), 'MMM dd, yyyy');
};

export const formatDateTime = (date: string | Date): string => {
  return format(new Date(date), 'MMM dd, yyyy HH:mm');
};

export const getRelativeTime = (date: string | Date): string => {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(date);
};

// Calculate portfolio value based on current asset prices
export const calculatePortfolioValue = (portfolio: Portfolio, initialInvestment = 10000): number => {
  const filledPlayers = portfolio.players.filter((p) => p.asset !== null);
  if (filledPlayers.length === 0) return initialInvestment;

  let totalValue = 0;
  const allocationPerPlayer = 100 / 11;

  portfolio.players.forEach((player) => {
    if (player.asset) {
      const investmentAmount = (initialInvestment * allocationPerPlayer) / 100;
      // Simulate some return based on day change
      const returnMultiplier = 1 + (player.asset.dayChangePercent / 100) * (Math.random() * 2 + 0.5);
      totalValue += investmentAmount * returnMultiplier;
    } else {
      totalValue += (initialInvestment * allocationPerPlayer) / 100;
    }
  });

  return totalValue;
};

/* Hash a string into a 32-bit unsigned int — used to seed the per-portfolio
   PRNG below so each squad has its own stable history. djb2-ish. */
const hashStringToInt = (str: string): number => {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) >>> 0;
  }
  return hash;
};

/* Mulberry32 — small, fast, deterministic PRNG. We use a fresh instance
   seeded per call so generatePortfolioHistory produces the SAME history
   for the same (portfolio, day) on every call. */
const mulberry32 = (seed: number) => () => {
  let t = (seed = (seed + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// Generate mock historical data for a portfolio.
//
// Must be deterministic for a given (portfolio.id, today) pair — earlier
// it called Math.random() inline, so any unrelated re-render that flowed
// through calculatePortfolioPerformance produced a new history and thus
// new EQUITY/TOTAL/TODAY numbers. Toggling a like on the squad detail
// page visibly reshuffled the headline stats. Now we seed a per-portfolio
// PRNG so the curve is stable until the day rolls over.
export const generatePortfolioHistory = (
  portfolio: Portfolio,
  days?: number
): { date: string; value: number }[] => {
  const history: { date: string; value: number }[] = [];
  let value = 10000;

  // Calculate days since portfolio creation
  const createdDate = new Date(portfolio.createdAt);
  const today = new Date();
  const daysSinceCreation = Math.max(0, Math.floor((today.getTime() - createdDate.getTime()) / 86400000));

  // Use the lesser of requested days or days since creation (max 365)
  const actualDays = days !== undefined
    ? Math.min(days, daysSinceCreation, 365)
    : Math.min(daysSinceCreation, 365);

  // Handle portfolios created today
  if (actualDays === 0) {
    return [{
      date: format(today, 'yyyy-MM-dd'),
      value: 10000,
    }];
  }

  // Seed per (portfolio, day) — same portfolio loaded twice on the same
  // day produces the same curve; tomorrow it shifts naturally.
  const todaySeed = Math.floor(today.getTime() / 86400000);
  const rng = mulberry32(hashStringToInt(portfolio.id || 'anon') ^ todaySeed);

  for (let i = actualDays; i >= 0; i--) {
    const date = subDays(new Date(), i);
    // Daily change between -2.88% and +3.12% (seeded — stable per portfolio)
    const dailyChange = (rng() - 0.48) * 0.06;
    value = value * (1 + dailyChange);
    history.push({
      date: format(date, 'yyyy-MM-dd'),
      value: Math.round(value * 100) / 100,
    });
  }

  return history;
};

// Calculate portfolio performance metrics
export const calculatePortfolioPerformance = (portfolio: Portfolio): PortfolioPerformance => {
  const history = generatePortfolioHistory(portfolio);
  const currentValue = history[history.length - 1].value;
  const initialValue = 10000;

  const dayAgoValue = history[history.length - 2]?.value || initialValue;
  const twoDaysAgoValue = history[history.length - 3]?.value || initialValue;
  const weekAgoValue = history[history.length - 8]?.value || initialValue;
  const twoWeeksAgoValue = history[history.length - 15]?.value || initialValue;
  const monthAgoValue = history[history.length - 31]?.value || initialValue;
  const yearAgoValue = history[0]?.value || initialValue;

  // Calculate beta (simplified - average of asset betas)
  const assetsWithBeta = portfolio.players.filter((p) => p.asset?.beta).map((p) => p.asset!.beta);
  const avgBeta = assetsWithBeta.length > 0
    ? assetsWithBeta.reduce((a, b) => a + b, 0) / assetsWithBeta.length
    : 1;

  // Calculate volatility (standard deviation of daily returns)
  const dailyReturns = history.length > 1
    ? history.slice(1).map((h, i) => (h.value - history[i].value) / history[i].value)
    : [0];
  const avgReturn = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
  const variance = dailyReturns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / dailyReturns.length;
  const volatility = Math.sqrt(variance) * Math.sqrt(252) * 100; // Annualized

  // Simplified Sharpe ratio (assuming risk-free rate of 4%)
  const annualReturn = ((currentValue - initialValue) / initialValue) * 100;
  const sharpeRatio = volatility > 0 ? (annualReturn - 4) / volatility : 0;

  // Max drawdown
  let maxDrawdown = 0;
  let peak = history[0].value;
  for (const point of history) {
    if (point.value > peak) peak = point.value;
    const drawdown = (peak - point.value) / peak;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }

  // Win rate (days with positive returns)
  const winDays = dailyReturns.filter((r) => r > 0).length;
  const winRate = dailyReturns.length > 0 ? (winDays / dailyReturns.length) * 100 : 0;

  // Day-over-day comparison calculations
  const todayChange = ((currentValue - dayAgoValue) / dayAgoValue) * 100;
  const yesterdayChange = ((dayAgoValue - twoDaysAgoValue) / twoDaysAgoValue) * 100;
  const dayVsPreviousDay = todayChange - yesterdayChange;

  const thisWeekChange = ((currentValue - weekAgoValue) / weekAgoValue) * 100;
  const lastWeekChange = ((weekAgoValue - twoWeeksAgoValue) / twoWeeksAgoValue) * 100;
  const weekVsPreviousWeek = thisWeekChange - lastWeekChange;

  const isImproving = dayVsPreviousDay > 0;

  return {
    portfolioId: portfolio.id,
    totalValue: currentValue,
    totalReturn: currentValue - initialValue,
    totalReturnPercent: ((currentValue - initialValue) / initialValue) * 100,
    dayReturn: currentValue - dayAgoValue,
    dayReturnPercent: ((currentValue - dayAgoValue) / dayAgoValue) * 100,
    weekReturn: currentValue - weekAgoValue,
    weekReturnPercent: ((currentValue - weekAgoValue) / weekAgoValue) * 100,
    monthReturn: currentValue - monthAgoValue,
    monthReturnPercent: ((currentValue - monthAgoValue) / monthAgoValue) * 100,
    yearReturn: currentValue - yearAgoValue,
    yearReturnPercent: ((currentValue - yearAgoValue) / yearAgoValue) * 100,
    beta: avgBeta,
    sharpeRatio: isNaN(sharpeRatio) ? 0 : sharpeRatio,
    volatility: isNaN(volatility) ? 0 : volatility,
    maxDrawdown: maxDrawdown * 100,
    winRate: isNaN(winRate) ? 0 : winRate,
    historicalData: history.map((h) => ({
      date: h.date,
      value: h.value,
      return: ((h.value - initialValue) / initialValue) * 100,
    })),
    // Day-over-day comparison fields
    dayVsPreviousDay: isNaN(dayVsPreviousDay) ? 0 : dayVsPreviousDay,
    weekVsPreviousWeek: isNaN(weekVsPreviousWeek) ? 0 : weekVsPreviousWeek,
    isImproving,
  };
};

// Calculate portfolio performance for a specific date range
export const calculatePortfolioPerformanceForDateRange = (
  portfolio: Portfolio,
  startDate: Date,
  endDate: Date
): PortfolioPerformance => {
  const fullHistory = generatePortfolioHistory(portfolio);
  const startDateStr = format(startDate, 'yyyy-MM-dd');
  const endDateStr = format(endDate, 'yyyy-MM-dd');

  // Filter history to the date range
  const filteredHistory = fullHistory.filter((h) => {
    return h.date >= startDateStr && h.date <= endDateStr;
  });

  // If no data in range, return default performance
  if (filteredHistory.length === 0) {
    return calculatePortfolioPerformance(portfolio);
  }

  const startValue = filteredHistory[0].value;
  const currentValue = filteredHistory[filteredHistory.length - 1].value;
  const initialValue = 10000;

  // Calculate beta (simplified - average of asset betas)
  const assetsWithBeta = portfolio.players.filter((p) => p.asset?.beta).map((p) => p.asset!.beta);
  const avgBeta = assetsWithBeta.length > 0
    ? assetsWithBeta.reduce((a, b) => a + b, 0) / assetsWithBeta.length
    : 1;

  // Calculate daily returns for the filtered period
  const dailyReturns = filteredHistory.length > 1
    ? filteredHistory.slice(1).map((h, i) => (h.value - filteredHistory[i].value) / filteredHistory[i].value)
    : [0];

  // Calculate volatility (annualized from daily returns in period)
  const avgReturn = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
  const variance = dailyReturns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / dailyReturns.length;
  const volatility = Math.sqrt(variance) * Math.sqrt(252) * 100; // Annualized

  // Period return (start to end value)
  const periodReturn = currentValue - startValue;
  const periodReturnPercent = ((currentValue - startValue) / startValue) * 100;

  // Annualized return calculation for Sharpe ratio
  const daysInPeriod = filteredHistory.length;
  const annualizedReturn = daysInPeriod > 0
    ? (Math.pow(currentValue / startValue, 365 / daysInPeriod) - 1) * 100
    : 0;

  // Simplified Sharpe ratio (assuming risk-free rate of 4%)
  const sharpeRatio = volatility > 0 ? (annualizedReturn - 4) / volatility : 0;

  // Max drawdown within the period
  let maxDrawdown = 0;
  let peak = filteredHistory[0].value;
  for (const point of filteredHistory) {
    if (point.value > peak) peak = point.value;
    const drawdown = (peak - point.value) / peak;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }

  // Win rate (positive days in period)
  const winDays = dailyReturns.filter((r) => r > 0).length;
  const winRate = dailyReturns.length > 0 ? (winDays / dailyReturns.length) * 100 : 0;

  // Calculate day-over-day metrics from filtered data
  const dayAgoIdx = filteredHistory.length - 2;
  const twoDaysAgoIdx = filteredHistory.length - 3;
  const weekAgoIdx = filteredHistory.length - 8;
  const twoWeeksAgoIdx = filteredHistory.length - 15;
  const monthAgoIdx = filteredHistory.length - 31;

  const dayAgoValue = dayAgoIdx >= 0 ? filteredHistory[dayAgoIdx].value : startValue;
  const twoDaysAgoValue = twoDaysAgoIdx >= 0 ? filteredHistory[twoDaysAgoIdx].value : startValue;
  const weekAgoValue = weekAgoIdx >= 0 ? filteredHistory[weekAgoIdx].value : startValue;
  const twoWeeksAgoValue = twoWeeksAgoIdx >= 0 ? filteredHistory[twoWeeksAgoIdx].value : startValue;
  const monthAgoValue = monthAgoIdx >= 0 ? filteredHistory[monthAgoIdx].value : startValue;
  const yearAgoValue = filteredHistory[0].value;

  // Day-over-day comparison calculations
  const todayChange = ((currentValue - dayAgoValue) / dayAgoValue) * 100;
  const yesterdayChange = ((dayAgoValue - twoDaysAgoValue) / twoDaysAgoValue) * 100;
  const dayVsPreviousDay = todayChange - yesterdayChange;

  const thisWeekChange = ((currentValue - weekAgoValue) / weekAgoValue) * 100;
  const lastWeekChange = ((weekAgoValue - twoWeeksAgoValue) / twoWeeksAgoValue) * 100;
  const weekVsPreviousWeek = thisWeekChange - lastWeekChange;

  const isImproving = dayVsPreviousDay > 0;

  return {
    portfolioId: portfolio.id,
    totalValue: currentValue,
    totalReturn: periodReturn,
    totalReturnPercent: periodReturnPercent,
    dayReturn: currentValue - dayAgoValue,
    dayReturnPercent: ((currentValue - dayAgoValue) / dayAgoValue) * 100,
    weekReturn: currentValue - weekAgoValue,
    weekReturnPercent: ((currentValue - weekAgoValue) / weekAgoValue) * 100,
    monthReturn: currentValue - monthAgoValue,
    monthReturnPercent: ((currentValue - monthAgoValue) / monthAgoValue) * 100,
    yearReturn: currentValue - yearAgoValue,
    yearReturnPercent: ((currentValue - yearAgoValue) / yearAgoValue) * 100,
    beta: avgBeta,
    sharpeRatio: isNaN(sharpeRatio) ? 0 : sharpeRatio,
    volatility: isNaN(volatility) ? 0 : volatility,
    maxDrawdown: maxDrawdown * 100,
    winRate: isNaN(winRate) ? 0 : winRate,
    historicalData: filteredHistory.map((h) => ({
      date: h.date,
      value: h.value,
      return: ((h.value - startValue) / startValue) * 100,
    })),
    // Day-over-day comparison fields
    dayVsPreviousDay: isNaN(dayVsPreviousDay) ? 0 : dayVsPreviousDay,
    weekVsPreviousWeek: isNaN(weekVsPreviousWeek) ? 0 : weekVsPreviousWeek,
    isImproving,
  };
};

// Get leaderboard entries
export const getLeaderboardEntries = (
  period: 'day' | 'week' | 'month' | 'year' | 'all' = 'month',
  limit: number = 20
): LeaderboardEntry[] => {
  const publicPortfolios = portfolioStorage.getPublic();

  const entries: LeaderboardEntry[] = publicPortfolios.map((portfolio) => {
    const user = userStorage.getUserById(portfolio.userId);
    const performance = calculatePortfolioPerformance(portfolio);

    let returnPercent: number;
    switch (period) {
      case 'day':
        returnPercent = performance.dayReturnPercent;
        break;
      case 'week':
        returnPercent = performance.weekReturnPercent;
        break;
      case 'month':
        returnPercent = performance.monthReturnPercent;
        break;
      case 'year':
        returnPercent = performance.yearReturnPercent;
        break;
      default:
        returnPercent = performance.totalReturnPercent;
    }

    return {
      rank: 0,
      userId: portfolio.userId,
      username: user?.username || 'Unknown',
      avatar: user?.avatar || '',
      portfolioId: portfolio.id,
      portfolioName: portfolio.name,
      formation: portfolio.formation,
      value: performance.totalValue,
      returnPercent,
      followers: user?.followers.length || 0,
      createdAt: portfolio.createdAt,
    };
  });

  // Sort by return and assign ranks
  entries.sort((a, b) => b.returnPercent - a.returnPercent);
  entries.forEach((entry, index) => {
    entry.rank = index + 1;
  });

  return entries.slice(0, limit);
};

// Social share URLs
export const getShareUrl = (portfolioId: string, platform: 'twitter' | 'facebook' | 'linkedin'): string => {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://gamefi.demo';
  const portfolioUrl = `${baseUrl}/portfolio/${portfolioId}`;
  const text = encodeURIComponent('Check out my investment portfolio on Gamefi Invest!');

  switch (platform) {
    case 'twitter':
      return `https://twitter.com/intent/tweet?url=${encodeURIComponent(portfolioUrl)}&text=${text}`;
    case 'facebook':
      return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(portfolioUrl)}`;
    case 'linkedin':
      return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(portfolioUrl)}`;
    default:
      return portfolioUrl;
  }
};

// Copy to clipboard
export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};

// Export portfolio to CSV
export const exportPortfolioToCSV = (portfolio: Portfolio, performance: PortfolioPerformance): void => {
  const rows = [
    ['Position', 'Asset', 'Symbol', 'Allocation', 'Current Price', 'Day Change'],
    ...portfolio.players.map((player) => [
      player.positionId,
      player.asset?.name || 'Empty',
      player.asset?.symbol || '-',
      `${(player.allocation).toFixed(2)}%`,
      player.asset ? formatCurrency(player.asset.currentPrice) : '-',
      player.asset ? formatPercent(player.asset.dayChangePercent) : '-',
    ]),
    [],
    ['Performance Metrics'],
    ['Total Value', formatCurrency(performance.totalValue)],
    ['Total Return', formatPercent(performance.totalReturnPercent)],
    ['Day Return', formatPercent(performance.dayReturnPercent)],
    ['Month Return', formatPercent(performance.monthReturnPercent)],
    ['Beta', performance.beta.toFixed(2)],
    ['Sharpe Ratio', performance.sharpeRatio.toFixed(2)],
    ['Volatility', `${performance.volatility.toFixed(2)}%`],
  ];

  const csvContent = rows.map((row) => row.join(',')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${portfolio.name}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
  link.click();
  URL.revokeObjectURL(url);
};

// Level calculation from XP
// Level thresholds:
// Level 1: 0 - 999 XP
// Level 2: 1000 - 2999 XP
// Level 3: 3000 - 4999 XP
// Level 4: 5000 - 9999 XP
// Level 5: 10000+ XP (max level)
export const calculateLevel = (xp: number): { level: number; currentXp: number; nextLevelXp: number; xpForCurrentLevel: number } => {
  const thresholds = [
    { level: 1, min: 0, max: 1000 },
    { level: 2, min: 1000, max: 3000 },
    { level: 3, min: 3000, max: 5000 },
    { level: 4, min: 5000, max: 10000 },
    { level: 5, min: 10000, max: Infinity },
  ];

  for (const threshold of thresholds) {
    if (xp < threshold.max) {
      const xpInLevel = xp - threshold.min;
      const xpNeededForLevel = threshold.max - threshold.min;
      return {
        level: threshold.level,
        currentXp: xpInLevel,
        nextLevelXp: xpNeededForLevel,
        xpForCurrentLevel: threshold.min,
      };
    }
  }

  // Max level reached (10000+ XP)
  return {
    level: 5,
    currentXp: xp - 10000,
    nextLevelXp: xp - 10000,
    xpForCurrentLevel: 10000,
  };
};

// ========== Fundamental Metrics Calculations ==========

/**
 * Calculate Alpha for a portfolio
 * Alpha = Portfolio Return - (Beta * Benchmark Return)
 */
export function calculateAlpha(
  portfolioReturn: number,
  portfolioBeta: number,
  benchmarkReturn: number
): number {
  return portfolioReturn - (portfolioBeta * benchmarkReturn);
}

/**
 * Calculate weighted average of a metric across portfolio holdings
 */
export function calculateWeightedMetric(
  players: PortfolioPlayer[],
  metricKey: keyof Asset
): number | null {
  const validPlayers = players.filter((p) => {
    if (!p.asset) return false;
    const value = p.asset[metricKey];
    return value !== null && value !== undefined && typeof value === 'number' && !isNaN(value);
  });

  if (validPlayers.length === 0) return null;

  const totalAllocation = validPlayers.reduce((sum, p) => sum + p.allocation, 0);
  if (totalAllocation === 0) return null;

  const weightedSum = validPlayers.reduce((sum, p) => {
    const value = p.asset![metricKey] as number;
    return sum + value * (p.allocation / totalAllocation);
  }, 0);

  return weightedSum;
}

/**
 * Portfolio aggregate metrics from fundamental data
 */
export interface PortfolioAggregateMetrics {
  weightedPE: number | null;
  weightedEPS: number | null;
  weightedPEG: number | null;
  weightedPriceToBook: number | null;
  weightedROE: number | null;
  weightedProfitMargin: number | null;
  weightedDebtToEquity: number | null;
}

/**
 * Calculate all portfolio-level aggregate metrics
 */
export function calculatePortfolioAggregateMetrics(
  players: PortfolioPlayer[]
): PortfolioAggregateMetrics {
  return {
    weightedPE: calculateWeightedMetric(players, 'peRatio'),
    weightedEPS: calculateWeightedMetric(players, 'eps'),
    weightedPEG: calculateWeightedMetric(players, 'pegRatio'),
    weightedPriceToBook: calculateWeightedMetric(players, 'priceToBook'),
    weightedROE: calculateWeightedMetric(players, 'returnOnEquity'),
    weightedProfitMargin: calculateWeightedMetric(players, 'profitMargin'),
    weightedDebtToEquity: calculateWeightedMetric(players, 'debtToEquity'),
  };
}

// ========== Formatting utilities for fundamental metrics ==========

export const formatPE = (value: number | null | undefined): string =>
  value === null || value === undefined ? 'N/A' : value.toFixed(2);

export const formatEPS = (value: number | null | undefined): string =>
  value === null || value === undefined ? 'N/A' : `$${value.toFixed(2)}`;

export const formatRatio = (value: number | null | undefined): string =>
  value === null || value === undefined ? 'N/A' : value.toFixed(2);

export const formatPercentMetric = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return 'N/A';
  // If value is already a decimal (e.g., 0.15 for 15%), multiply by 100
  const displayValue = Math.abs(value) < 1 ? value * 100 : value;
  return `${displayValue.toFixed(2)}%`;
};

export const formatMarketCap = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return 'N/A';
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  return `$${value.toFixed(0)}`;
};

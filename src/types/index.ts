// Team/Portfolio Limits
export const DEFAULT_MAX_TEAMS = 3;
export const TEAM_SLOT_UNLOCK_COST = 1000; // XP cost to unlock additional team slot

// Challenge Types
export type ChallengeType = 'sp500' | 'user' | 'etf';
export type ChallengeStatus = 'pending' | 'active' | 'completed' | 'declined' | 'cancelled';
export type ChallengeTimeframe = '1W' | '2W' | '1M' | '3M';

export interface Challenge {
  id: string;
  type: ChallengeType;
  status: ChallengeStatus;
  challengerId: string;
  challengerPortfolioId: string;
  opponentId: string | null;
  opponentPortfolioId: string | null;
  /* For type='etf' fixtures: the Yahoo ticker of the benchmark
     (e.g. 'QQQ', 'ARKK', 'VTI'). Null for sp500/user types. */
  opponentSymbol?: string | null;
  timeframe: ChallengeTimeframe;
  startDate: string | null;
  endDate: string | null;
  challengerStartValue: number | null;
  challengerEndValue: number | null;
  opponentStartValue: number | null;
  opponentEndValue: number | null;
  challengerReturnPercent: number | null;
  opponentReturnPercent: number | null;
  winnerId: string | null;
  xpAwarded: number | null;
  createdAt: string;
  settledAt: string | null;
  // Joined data for display
  challengerUsername?: string;
  challengerAvatar?: string;
  challengerPortfolioName?: string;
  opponentUsername?: string;
  opponentAvatar?: string;
  opponentPortfolioName?: string;
}

export const CHALLENGE_XP = { VS_SP500: 100, VS_USER: 200, VS_ETF: 150 };
export const MAX_ACTIVE_CHALLENGES = 3;

/* XP multiplier by challenge timeframe — longer commitments pay more.
   Applied at settle time: awarded = base * CHALLENGE_TIMEFRAME_XP_MULT[timeframe]. */
export const CHALLENGE_TIMEFRAME_XP_MULT: Record<ChallengeTimeframe, number> = {
  '1W': 1.0,
  '2W': 1.5,
  '1M': 2.5,
  '3M': 5.0,
};

// Training / lesson completion
export const LESSON_COMPLETION_XP = 100;

export interface LessonCompletion {
  id: string;
  userId: string;
  lessonId: string;
  moduleId: string;
  completedAt: string;
  xpAwarded: number;
}

export const CHALLENGE_TIMEFRAMES: { value: ChallengeTimeframe; label: string; days: number }[] = [
  { value: '1W', label: '1 Week', days: 7 },
  { value: '2W', label: '2 Weeks', days: 14 },
  { value: '1M', label: '1 Month', days: 30 },
  { value: '3M', label: '3 Months', days: 90 },
];

// User Types
export interface User {
  id: string;
  username: string;
  email: string;
  displayName: string;
  avatar: string;
  bio: string;
  joinedAt: string;
  followers: string[];
  following: string[];
  portfolios: string[];
  totalRewards: number;
  badges: Badge[];
  level: number;
  xp: number;
  maxTeams: number; // Maximum number of teams user can create (default: 3)
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  earnedAt: string;
}

// Asset Types
export type AssetType = 'stock' | 'etf' | 'bond' | 'commodity' | 'reit';

export interface Asset {
  id: string;
  symbol: string;
  name: string;
  type: AssetType;
  sector: string;
  currentPrice: number;
  previousClose: number;
  dayChange: number;
  dayChangePercent: number;
  marketCap: number;
  beta: number;
  peRatio: number | null;
  dividendYield: number;
  weekHigh52: number;
  weekLow52: number;
  logoUrl?: string;
  // Extended fundamental metrics
  eps?: number | null;
  forwardEps?: number | null;
  forwardPE?: number | null;
  pegRatio?: number | null;
  priceToBook?: number | null;
  returnOnEquity?: number | null;
  returnOnAssets?: number | null;
  profitMargin?: number | null;
  operatingMargin?: number | null;
  grossMargin?: number | null;
  debtToEquity?: number | null;
  currentRatio?: number | null;
  revenueGrowth?: number | null;
  earningsGrowth?: number | null;
  industry?: string | null;
}

export interface AssetHistoricalData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Soccer Formation Types
export type Formation = '4-3-3' | '4-4-2' | '3-5-2' | '5-3-2' | '4-2-3-1' | '3-4-3';

export interface Position {
  id: string;
  name: string;
  shortName: string;
  row: number; // 0 = goalkeeper, 1 = defense, 2 = midfield, 3 = attack
  col: number; // Position within the row
}

export const FORMATIONS: Record<Formation, Position[]> = {
  '4-3-3': [
    { id: 'gk', name: 'Goalkeeper', shortName: 'GK', row: 0, col: 1 },
    { id: 'lb', name: 'Left Back', shortName: 'LB', row: 1, col: 0 },
    { id: 'cb1', name: 'Center Back', shortName: 'CB', row: 1, col: 1 },
    { id: 'cb2', name: 'Center Back', shortName: 'CB', row: 1, col: 2 },
    { id: 'rb', name: 'Right Back', shortName: 'RB', row: 1, col: 3 },
    { id: 'lm', name: 'Left Midfielder', shortName: 'LM', row: 2, col: 0 },
    { id: 'cm', name: 'Center Midfielder', shortName: 'CM', row: 2, col: 1 },
    { id: 'rm', name: 'Right Midfielder', shortName: 'RM', row: 2, col: 2 },
    { id: 'lw', name: 'Left Wing', shortName: 'LW', row: 3, col: 0 },
    { id: 'st', name: 'Striker', shortName: 'ST', row: 3, col: 1 },
    { id: 'rw', name: 'Right Wing', shortName: 'RW', row: 3, col: 2 },
  ],
  '4-4-2': [
    { id: 'gk', name: 'Goalkeeper', shortName: 'GK', row: 0, col: 1 },
    { id: 'lb', name: 'Left Back', shortName: 'LB', row: 1, col: 0 },
    { id: 'cb1', name: 'Center Back', shortName: 'CB', row: 1, col: 1 },
    { id: 'cb2', name: 'Center Back', shortName: 'CB', row: 1, col: 2 },
    { id: 'rb', name: 'Right Back', shortName: 'RB', row: 1, col: 3 },
    { id: 'lm', name: 'Left Midfielder', shortName: 'LM', row: 2, col: 0 },
    { id: 'lcm', name: 'Left Center Mid', shortName: 'LCM', row: 2, col: 1 },
    { id: 'rcm', name: 'Right Center Mid', shortName: 'RCM', row: 2, col: 2 },
    { id: 'rm', name: 'Right Midfielder', shortName: 'RM', row: 2, col: 3 },
    { id: 'st1', name: 'Striker', shortName: 'ST', row: 3, col: 0 },
    { id: 'st2', name: 'Striker', shortName: 'ST', row: 3, col: 1 },
  ],
  '3-5-2': [
    { id: 'gk', name: 'Goalkeeper', shortName: 'GK', row: 0, col: 1 },
    { id: 'cb1', name: 'Center Back', shortName: 'CB', row: 1, col: 0 },
    { id: 'cb2', name: 'Center Back', shortName: 'CB', row: 1, col: 1 },
    { id: 'cb3', name: 'Center Back', shortName: 'CB', row: 1, col: 2 },
    { id: 'lwb', name: 'Left Wing Back', shortName: 'LWB', row: 2, col: 0 },
    { id: 'lcm', name: 'Left Center Mid', shortName: 'LCM', row: 2, col: 1 },
    { id: 'cdm', name: 'Defensive Mid', shortName: 'CDM', row: 2, col: 2 },
    { id: 'rcm', name: 'Right Center Mid', shortName: 'RCM', row: 2, col: 3 },
    { id: 'rwb', name: 'Right Wing Back', shortName: 'RWB', row: 2, col: 4 },
    { id: 'st1', name: 'Striker', shortName: 'ST', row: 3, col: 0 },
    { id: 'st2', name: 'Striker', shortName: 'ST', row: 3, col: 1 },
  ],
  '5-3-2': [
    { id: 'gk', name: 'Goalkeeper', shortName: 'GK', row: 0, col: 2 },
    { id: 'lwb', name: 'Left Wing Back', shortName: 'LWB', row: 1, col: 0 },
    { id: 'cb1', name: 'Center Back', shortName: 'CB', row: 1, col: 1 },
    { id: 'cb2', name: 'Center Back', shortName: 'CB', row: 1, col: 2 },
    { id: 'cb3', name: 'Center Back', shortName: 'CB', row: 1, col: 3 },
    { id: 'rwb', name: 'Right Wing Back', shortName: 'RWB', row: 1, col: 4 },
    { id: 'lm', name: 'Left Midfielder', shortName: 'LM', row: 2, col: 0 },
    { id: 'cm', name: 'Center Midfielder', shortName: 'CM', row: 2, col: 1 },
    { id: 'rm', name: 'Right Midfielder', shortName: 'RM', row: 2, col: 2 },
    { id: 'st1', name: 'Striker', shortName: 'ST', row: 3, col: 0 },
    { id: 'st2', name: 'Striker', shortName: 'ST', row: 3, col: 1 },
  ],
  '4-2-3-1': [
    { id: 'gk', name: 'Goalkeeper', shortName: 'GK', row: 0, col: 1 },
    { id: 'lb', name: 'Left Back', shortName: 'LB', row: 1, col: 0 },
    { id: 'cb1', name: 'Center Back', shortName: 'CB', row: 1, col: 1 },
    { id: 'cb2', name: 'Center Back', shortName: 'CB', row: 1, col: 2 },
    { id: 'rb', name: 'Right Back', shortName: 'RB', row: 1, col: 3 },
    { id: 'cdm1', name: 'Defensive Mid', shortName: 'CDM', row: 2, col: 0 },
    { id: 'cdm2', name: 'Defensive Mid', shortName: 'CDM', row: 2, col: 1 },
    { id: 'lam', name: 'Left Attacking Mid', shortName: 'LAM', row: 2, col: 2 },
    { id: 'cam', name: 'Center Attacking Mid', shortName: 'CAM', row: 2, col: 3 },
    { id: 'ram', name: 'Right Attacking Mid', shortName: 'RAM', row: 2, col: 4 },
    { id: 'st', name: 'Striker', shortName: 'ST', row: 3, col: 0 },
  ],
  '3-4-3': [
    { id: 'gk', name: 'Goalkeeper', shortName: 'GK', row: 0, col: 1 },
    { id: 'cb1', name: 'Center Back', shortName: 'CB', row: 1, col: 0 },
    { id: 'cb2', name: 'Center Back', shortName: 'CB', row: 1, col: 1 },
    { id: 'cb3', name: 'Center Back', shortName: 'CB', row: 1, col: 2 },
    { id: 'lm', name: 'Left Midfielder', shortName: 'LM', row: 2, col: 0 },
    { id: 'lcm', name: 'Left Center Mid', shortName: 'LCM', row: 2, col: 1 },
    { id: 'rcm', name: 'Right Center Mid', shortName: 'RCM', row: 2, col: 2 },
    { id: 'rm', name: 'Right Midfielder', shortName: 'RM', row: 2, col: 3 },
    { id: 'lw', name: 'Left Wing', shortName: 'LW', row: 3, col: 0 },
    { id: 'st', name: 'Striker', shortName: 'ST', row: 3, col: 1 },
    { id: 'rw', name: 'Right Wing', shortName: 'RW', row: 3, col: 2 },
  ],
};

// Portfolio Player (Asset in a position)
export interface PortfolioPlayer {
  positionId: string;
  asset: Asset | null;
  allocation: number; // Should be approximately 9.09% (100/11) per player
  /* True when the player sits on the bench (11 reserves alongside the
     11 starters). Bench players have allocation 0 and don't contribute
     to portfolio returns until subbed onto the pitch in a weekend
     swap. Undefined/false = starter, for backwards-compat with old
     11-player rows. */
  isBench?: boolean;
}

// Portfolio Types
export interface Portfolio {
  id: string;
  userId: string;
  name: string;
  description: string;
  formation: Formation;
  players: PortfolioPlayer[];
  createdAt: string;
  updatedAt: string;
  isPublic: boolean;
  likes: string[];
  clonedFrom: string | null;
  cloneCount: number;
  tags: string[];
  /* Privacy gate flags set by the API when a non-owner viewer fetches
     this portfolio. isSnapshot=true means players/formation reflect
     the last Fri 21:00 UTC snapshot rather than live; snapshotGameweek
     identifies which week; noSnapshotAvailable=true on first-week view
     when no snapshot has been taken yet. */
  isSnapshot?: boolean;
  snapshotGameweek?: number;
  noSnapshotAvailable?: boolean;
}

export interface PortfolioPerformance {
  portfolioId: string;
  totalValue: number;
  totalReturn: number;
  totalReturnPercent: number;
  dayReturn: number;
  dayReturnPercent: number;
  weekReturn: number;
  weekReturnPercent: number;
  monthReturn: number;
  monthReturnPercent: number;
  yearReturn: number;
  yearReturnPercent: number;
  beta: number;
  sharpeRatio: number;
  volatility: number;
  maxDrawdown: number;
  winRate: number;
  historicalData: PortfolioHistoricalPoint[];
  // Day-over-day comparison fields
  dayVsPreviousDay: number;        // Today's change vs yesterday's change
  weekVsPreviousWeek: number;      // This week vs last week
  isImproving: boolean;            // Trend indicator
  // Portfolio-level calculated fundamental metrics
  alpha?: number | null;           // Portfolio Return - (Beta * Benchmark Return)
  weightedPE?: number | null;      // Weighted average P/E
  weightedEPS?: number | null;     // Weighted average EPS
  weightedPEG?: number | null;     // Weighted average PEG
  weightedPriceToBook?: number | null;
  weightedROE?: number | null;     // Weighted average ROE
  weightedProfitMargin?: number | null;
  weightedDebtToEquity?: number | null;
  benchmarkReturn?: number | null; // For Alpha calculation
  benchmarkSymbol?: string;        // e.g., 'SPY'
}

export interface PortfolioHistoricalPoint {
  date: string;
  value: number;
  return: number;
}

// Leaderboard Types
export type LeaderboardPeriod = 'day' | 'week' | 'month' | 'year' | 'all';
export type LeaderboardMetric = 'return' | 'sharpe' | 'followers' | 'likes';

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  avatar: string;
  portfolioId: string;
  portfolioName: string;
  formation: Formation;
  value: number;
  returnPercent: number;
  followers: number;
  createdAt: string;
}

// Social Types
export interface Activity {
  id: string;
  userId: string;
  username: string;
  avatar: string;
  type: 'created_portfolio' | 'liked_portfolio' | 'cloned_portfolio' | 'followed_user' | 'earned_badge' | 'rebalanced';
  targetId: string;
  targetName: string;
  timestamp: string;
}

export type NotificationType =
  | 'new_follower'
  | 'portfolio_liked'
  | 'portfolio_cloned'
  | 'badge_earned'
  | 'reward_earned'
  | 'challenge_received'
  | 'challenge_accepted'
  | 'challenge_declined'
  | 'challenge_won'
  | 'challenge_lost'
  | 'challenge_draw';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  message: string;
  read: boolean;
  createdAt: string;
  data?: Record<string, unknown>;
}

// Reward Types
export interface Reward {
  id: string;
  name: string;
  description: string;
  xpAmount: number;
  type: 'daily_login' | 'portfolio_created' | 'first_follow' | 'top_performer' | 'social_engagement';
  earnedAt: string;
}

// Risk Level Types
export type RiskLevel = 'low' | 'medium' | 'high';

export const POSITION_RISK_MAP: Record<number, RiskLevel> = {
  0: 'low',     // Goalkeeper - ultra safe
  1: 'low',     // Defenders - low risk
  2: 'medium',  // Midfielders - medium risk
  3: 'high',    // Attackers - high risk
};

// Get risk level from asset beta
export const getAssetRiskLevel = (beta: number): RiskLevel => {
  if (beta < 0.8) return 'low';
  if (beta <= 1.2) return 'medium';
  return 'high';
};

// Utility types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Authentication Types
export interface UserCredentials {
  id: string;
  userId: string;
  passwordHash: string;
  salt: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  success: boolean;
  user?: User;
  error?: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

export interface LoginRequest {
  identifier: string; // username or email
  password: string;
}

// Benchmark Types
export type BenchmarkSymbol = 'SPY' | 'QQQ' | 'DIA' | 'IWM' | 'VTI';

export interface BenchmarkInfo {
  symbol: BenchmarkSymbol;
  name: string;
  description: string;
  color: string;
}

export const BENCHMARKS: BenchmarkInfo[] = [
  { symbol: 'SPY', name: 'S&P 500', description: 'SPDR S&P 500 ETF - Large-cap US stocks', color: '#ef4444' },
  { symbol: 'QQQ', name: 'Nasdaq 100', description: 'Invesco QQQ Trust - Tech-heavy index', color: '#f59e0b' },
  { symbol: 'DIA', name: 'Dow Jones', description: 'SPDR Dow Jones Industrial Average ETF', color: '#3b82f6' },
  { symbol: 'IWM', name: 'Russell 2000', description: 'iShares Russell 2000 ETF - Small-cap stocks', color: '#8b5cf6' },
  { symbol: 'VTI', name: 'Total Market', description: 'Vanguard Total Stock Market ETF', color: '#06b6d4' },
];

export type ComparisonTimeframe = '1W' | '1M' | '3M' | '6M' | '1Y' | 'YTD';

export const COMPARISON_TIMEFRAMES: { value: ComparisonTimeframe; label: string }[] = [
  { value: '1W', label: '1W' },
  { value: '1M', label: '1M' },
  { value: '3M', label: '3M' },
  { value: '6M', label: '6M' },
  { value: '1Y', label: '1Y' },
  { value: 'YTD', label: 'YTD' },
];

export interface CustomDateRange {
  startDate: string;
  endDate: string;
}

export interface CustomComparisonSymbol {
  symbol: string;
  name: string;
  color: string;
}

export interface HistoricalDataPoint {
  timestamp: number;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  adjClose: number;
}

export interface BenchmarkPerformance {
  symbol: BenchmarkSymbol;
  name: string;
  color: string;
  totalValue: number;
  totalReturn: number;
  totalReturnPercent: number;
  volatility: number;
  sharpeRatio: number;
  maxDrawdown: number;
  beta: number;
  winRate: number;
  historicalData: HistoricalDataPoint[];
  normalizedData: { date: string; value: number }[];
}

// ============================================
// DAILY LOGIN REWARDS
// ============================================
export interface DailyReward {
  id: string;
  userId: string;
  claimedAt: string;
  xpAwarded: number;
  streakDay: number; // Which day of the streak (1-7)
  streakBonus: number; // Bonus XP for streak
}

export interface UserStreak {
  id: string;
  userId: string;
  currentStreak: number;
  longestStreak: number;
  lastClaimDate: string | null;
  totalDaysClaimed: number;
}

// Streak rewards: Day 1-6 = 10 XP, Day 7 = 50 XP bonus
export const DAILY_LOGIN_REWARDS = {
  BASE_XP: 10,
  STREAK_7_BONUS: 50,
  MAX_STREAK_DISPLAY: 7,
};

// ============================================
// ACHIEVEMENT BADGES SYSTEM
// ============================================
export type BadgeCategory = 'portfolio' | 'social' | 'challenge' | 'learning' | 'streak' | 'special';
export type BadgeRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface AchievementBadge {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: BadgeCategory;
  rarity: BadgeRarity;
  xpReward: number;
  requirement: {
    type: string;
    value: number;
  };
}

export interface UserBadge {
  id: string;
  badgeId: string;
  userId: string;
  earnedAt: string;
  badge?: AchievementBadge; // Joined data
}

export const ACHIEVEMENT_BADGES: AchievementBadge[] = [
  // Portfolio Badges
  { id: 'first_portfolio', name: 'Team Builder', description: 'Create your first portfolio', icon: '🏗️', category: 'portfolio', rarity: 'common', xpReward: 50, requirement: { type: 'portfolios_created', value: 1 } },
  { id: 'five_portfolios', name: 'Portfolio Manager', description: 'Create 5 portfolios', icon: '📊', category: 'portfolio', rarity: 'rare', xpReward: 150, requirement: { type: 'portfolios_created', value: 5 } },
  { id: 'full_team', name: 'Full Squad', description: 'Fill all 11 positions in a portfolio', icon: '⚽', category: 'portfolio', rarity: 'common', xpReward: 75, requirement: { type: 'full_portfolio', value: 1 } },
  { id: 'diversified', name: 'Diversifier', description: 'Have 5+ different sectors in one portfolio', icon: '🌈', category: 'portfolio', rarity: 'rare', xpReward: 100, requirement: { type: 'sectors_count', value: 5 } },

  // Challenge Badges
  { id: 'first_win', name: 'First Victory', description: 'Win your first challenge', icon: '🏆', category: 'challenge', rarity: 'common', xpReward: 50, requirement: { type: 'challenges_won', value: 1 } },
  { id: 'win_streak_3', name: 'Hot Streak', description: 'Win 3 challenges in a row', icon: '🔥', category: 'challenge', rarity: 'rare', xpReward: 200, requirement: { type: 'win_streak', value: 3 } },
  { id: 'win_streak_5', name: 'Unstoppable', description: 'Win 5 challenges in a row', icon: '💪', category: 'challenge', rarity: 'epic', xpReward: 500, requirement: { type: 'win_streak', value: 5 } },
  { id: 'beat_sp500', name: 'Market Beater', description: 'Beat S&P 500 in a challenge', icon: '📈', category: 'challenge', rarity: 'common', xpReward: 100, requirement: { type: 'beat_sp500', value: 1 } },
  { id: 'ten_wins', name: 'Champion', description: 'Win 10 challenges', icon: '👑', category: 'challenge', rarity: 'epic', xpReward: 300, requirement: { type: 'challenges_won', value: 10 } },

  // Social Badges
  { id: 'first_follower', name: 'Influencer', description: 'Get your first follower', icon: '👥', category: 'social', rarity: 'common', xpReward: 25, requirement: { type: 'followers', value: 1 } },
  { id: 'ten_followers', name: 'Rising Star', description: 'Reach 10 followers', icon: '⭐', category: 'social', rarity: 'rare', xpReward: 150, requirement: { type: 'followers', value: 10 } },
  { id: 'portfolio_liked', name: 'Crowd Favorite', description: 'Get 10 likes on a portfolio', icon: '❤️', category: 'social', rarity: 'rare', xpReward: 100, requirement: { type: 'portfolio_likes', value: 10 } },
  { id: 'portfolio_cloned', name: 'Trendsetter', description: 'Have your portfolio cloned 5 times', icon: '📋', category: 'social', rarity: 'epic', xpReward: 250, requirement: { type: 'portfolio_clones', value: 5 } },

  // Streak Badges
  { id: 'streak_7', name: 'Week Warrior', description: 'Maintain a 7-day login streak', icon: '📅', category: 'streak', rarity: 'common', xpReward: 100, requirement: { type: 'login_streak', value: 7 } },
  { id: 'streak_30', name: 'Monthly Master', description: 'Maintain a 30-day login streak', icon: '🗓️', category: 'streak', rarity: 'epic', xpReward: 500, requirement: { type: 'login_streak', value: 30 } },
  { id: 'streak_100', name: 'Centurion', description: 'Maintain a 100-day login streak', icon: '💯', category: 'streak', rarity: 'legendary', xpReward: 1500, requirement: { type: 'login_streak', value: 100 } },

  // Learning Badges
  { id: 'first_lesson', name: 'Student', description: 'Complete your first lesson', icon: '📚', category: 'learning', rarity: 'common', xpReward: 25, requirement: { type: 'lessons_completed', value: 1 } },
  { id: 'all_lessons', name: 'Graduate', description: 'Complete all learning modules', icon: '🎓', category: 'learning', rarity: 'epic', xpReward: 500, requirement: { type: 'lessons_completed', value: 10 } },

  // Special Badges
  { id: 'early_adopter', name: 'Early Adopter', description: 'Joined during beta', icon: '🚀', category: 'special', rarity: 'legendary', xpReward: 500, requirement: { type: 'special', value: 1 } },
  { id: 'referral_master', name: 'Recruiter', description: 'Refer 5 friends', icon: '🤝', category: 'special', rarity: 'epic', xpReward: 500, requirement: { type: 'referrals', value: 5 } },
];

// ============================================
// REFERRAL SYSTEM
// ============================================
export interface Referral {
  id: string;
  referrerId: string; // User who shared the code
  referredId: string; // User who used the code
  referralCode: string;
  status: 'pending' | 'completed';
  xpAwarded: number;
  createdAt: string;
  completedAt: string | null;
}

export interface UserReferralInfo {
  referralCode: string;
  totalReferrals: number;
  pendingReferrals: number;
  totalXpEarned: number;
}

export const REFERRAL_REWARDS = {
  REFERRER_XP: 100, // XP for the person who referred
  REFERRED_XP: 50, // Bonus XP for the new user
};

// ============================================
// PRICE ALERTS
// ============================================
export type AlertCondition = 'above' | 'below' | 'percent_change';

export interface PriceAlert {
  id: string;
  userId: string;
  symbol: string;
  assetName: string;
  condition: AlertCondition;
  targetPrice: number | null; // For above/below
  targetPercent: number | null; // For percent_change
  currentPrice: number;
  isActive: boolean;
  isTriggered: boolean;
  triggeredAt: string | null;
  createdAt: string;
}

export const MAX_PRICE_ALERTS = 10;

// ============================================
// PORTFOLIO TEMPLATES
// ============================================
export type TemplateCategory = 'growth' | 'dividend' | 'balanced' | 'sector' | 'trending';

export interface PortfolioTemplate {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  formation: Formation;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  expectedRisk: RiskLevel;
  stocks: {
    positionId: string;
    symbol: string;
    allocation: number;
  }[];
  tags: string[];
  popularity: number; // Clone count
}

export const PORTFOLIO_TEMPLATES: PortfolioTemplate[] = [
  {
    id: 'tech_titans',
    name: 'Tech Titans',
    description: 'Top technology companies leading innovation',
    category: 'growth',
    formation: '4-3-3',
    difficulty: 'beginner',
    expectedRisk: 'high',
    stocks: [
      { positionId: 'gk', symbol: 'MSFT', allocation: 9.1 },
      { positionId: 'lb', symbol: 'GOOGL', allocation: 9.1 },
      { positionId: 'cb1', symbol: 'AAPL', allocation: 9.1 },
      { positionId: 'cb2', symbol: 'AMZN', allocation: 9.1 },
      { positionId: 'rb', symbol: 'META', allocation: 9.1 },
      { positionId: 'lm', symbol: 'NVDA', allocation: 9.1 },
      { positionId: 'cm', symbol: 'TSLA', allocation: 9.1 },
      { positionId: 'rm', symbol: 'AMD', allocation: 9.1 },
      { positionId: 'lw', symbol: 'CRM', allocation: 9.1 },
      { positionId: 'st', symbol: 'NFLX', allocation: 9.1 },
      { positionId: 'rw', symbol: 'ADBE', allocation: 9.0 },
    ],
    tags: ['technology', 'growth', 'large-cap'],
    popularity: 0,
  },
  {
    id: 'dividend_kings',
    name: 'Dividend Kings',
    description: 'Stable dividend-paying blue chip stocks',
    category: 'dividend',
    formation: '4-4-2',
    difficulty: 'beginner',
    expectedRisk: 'low',
    stocks: [
      { positionId: 'gk', symbol: 'JNJ', allocation: 9.1 },
      { positionId: 'lb', symbol: 'PG', allocation: 9.1 },
      { positionId: 'cb1', symbol: 'KO', allocation: 9.1 },
      { positionId: 'cb2', symbol: 'PEP', allocation: 9.1 },
      { positionId: 'rb', symbol: 'MMM', allocation: 9.1 },
      { positionId: 'lm', symbol: 'XOM', allocation: 9.1 },
      { positionId: 'lcm', symbol: 'CVX', allocation: 9.1 },
      { positionId: 'rcm', symbol: 'VZ', allocation: 9.1 },
      { positionId: 'rm', symbol: 'T', allocation: 9.1 },
      { positionId: 'st1', symbol: 'IBM', allocation: 9.1 },
      { positionId: 'st2', symbol: 'MCD', allocation: 9.0 },
    ],
    tags: ['dividend', 'income', 'stable'],
    popularity: 0,
  },
  {
    id: 'balanced_growth',
    name: 'Balanced Growth',
    description: 'Mix of growth and value stocks for stability',
    category: 'balanced',
    formation: '4-3-3',
    difficulty: 'intermediate',
    expectedRisk: 'medium',
    stocks: [
      { positionId: 'gk', symbol: 'BRK-B', allocation: 9.1 },
      { positionId: 'lb', symbol: 'JPM', allocation: 9.1 },
      { positionId: 'cb1', symbol: 'V', allocation: 9.1 },
      { positionId: 'cb2', symbol: 'MA', allocation: 9.1 },
      { positionId: 'rb', symbol: 'UNH', allocation: 9.1 },
      { positionId: 'lm', symbol: 'HD', allocation: 9.1 },
      { positionId: 'cm', symbol: 'DIS', allocation: 9.1 },
      { positionId: 'rm', symbol: 'COST', allocation: 9.1 },
      { positionId: 'lw', symbol: 'AAPL', allocation: 9.1 },
      { positionId: 'st', symbol: 'MSFT', allocation: 9.1 },
      { positionId: 'rw', symbol: 'GOOGL', allocation: 9.0 },
    ],
    tags: ['balanced', 'diversified', 'mixed'],
    popularity: 0,
  },
  {
    id: 'healthcare_heroes',
    name: 'Healthcare Heroes',
    description: 'Leading healthcare and pharmaceutical companies',
    category: 'sector',
    formation: '3-5-2',
    difficulty: 'intermediate',
    expectedRisk: 'medium',
    stocks: [
      { positionId: 'gk', symbol: 'JNJ', allocation: 9.1 },
      { positionId: 'cb1', symbol: 'UNH', allocation: 9.1 },
      { positionId: 'cb2', symbol: 'PFE', allocation: 9.1 },
      { positionId: 'cb3', symbol: 'MRK', allocation: 9.1 },
      { positionId: 'lwb', symbol: 'ABBV', allocation: 9.1 },
      { positionId: 'lcm', symbol: 'LLY', allocation: 9.1 },
      { positionId: 'cdm', symbol: 'TMO', allocation: 9.1 },
      { positionId: 'rcm', symbol: 'ABT', allocation: 9.1 },
      { positionId: 'rwb', symbol: 'DHR', allocation: 9.1 },
      { positionId: 'st1', symbol: 'BMY', allocation: 9.1 },
      { positionId: 'st2', symbol: 'AMGN', allocation: 9.0 },
    ],
    tags: ['healthcare', 'pharmaceutical', 'defensive'],
    popularity: 0,
  },
  {
    id: 'ai_revolution',
    name: 'AI Revolution',
    description: 'Companies leading the artificial intelligence boom',
    category: 'trending',
    formation: '4-3-3',
    difficulty: 'advanced',
    expectedRisk: 'high',
    stocks: [
      { positionId: 'gk', symbol: 'NVDA', allocation: 12 },
      { positionId: 'lb', symbol: 'MSFT', allocation: 10 },
      { positionId: 'cb1', symbol: 'GOOGL', allocation: 10 },
      { positionId: 'cb2', symbol: 'META', allocation: 9 },
      { positionId: 'rb', symbol: 'AMZN', allocation: 9 },
      { positionId: 'lm', symbol: 'AMD', allocation: 9 },
      { positionId: 'cm', symbol: 'PLTR', allocation: 8 },
      { positionId: 'rm', symbol: 'CRM', allocation: 8 },
      { positionId: 'lw', symbol: 'SNOW', allocation: 8 },
      { positionId: 'st', symbol: 'AI', allocation: 9 },
      { positionId: 'rw', symbol: 'PATH', allocation: 8 },
    ],
    tags: ['AI', 'technology', 'growth', 'trending'],
    popularity: 0,
  },
];

// ============================================
// THEME SETTINGS
// ============================================
export type ThemeMode = 'dark' | 'light' | 'system';

export interface UserPreferences {
  theme: ThemeMode;
  notifications: {
    email: boolean;
    push: boolean;
    priceAlerts: boolean;
    challengeUpdates: boolean;
    socialUpdates: boolean;
  };
  displayCurrency: string;
}

// ============================================
// ONBOARDING
// ============================================
export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  target: string; // CSS selector for highlighting
  position: 'top' | 'bottom' | 'left' | 'right';
}

export interface UserOnboarding {
  hasCompletedOnboarding: boolean;
  currentStep: number;
  skippedAt: string | null;
  completedAt: string | null;
}

/* Updated post-stadium rewrite. Copy now matches the actual app
   vocabulary (Squads, Matchday, Fixtures, Training) and leads with
   "paper money" reassurance because Sarah-from-the-tester-personas
   was visibly anxious that real money was at stake. Targets are
   intentionally empty for now — the spotlight feature wasn't doing
   anything useful because no element in the app had a matching
   data-tour attribute. Future: wire data-tour to Sidebar nav items. */
export const ONBOARDING_STEPS: OnboardingStep[] = [
  { id: 'welcome',          title: 'Welcome to Gamefi Invest',     description: 'This is a free practice league. You build squads of real stocks, the prices are real, but the money is fake — no card, no risk.', target: '', position: 'bottom' },
  { id: 'matchday',         title: 'Your Matchday HQ',             description: 'The Matchday tab tracks your XP, level, and squad performance. Sidebar on the left, season pill above your level rail.', target: '', position: 'bottom' },
  { id: 'create_squad',     title: 'Build your first Squad',       description: 'Squads are portfolios of 22 stocks: 11 starters that count for returns, 11 reserves on the bench. Pick a formation, sign 22 players.', target: '', position: 'right' },
  { id: 'sign_players',     title: 'Sign players in one go',       description: 'Use Sign Squad to fill all 22 slots in one screen. Or use the Market tab to find a specific ticker — click Sign and choose which squad it joins.', target: '', position: 'right' },
  { id: 'fixtures',         title: 'Beat the index',               description: 'Fixtures are 1-week to 3-month challenges. Beat the S&P 500, any ETF, or another manager. Longer timeframes pay more XP.', target: '', position: 'right' },
  { id: 'training',         title: 'Training Ground',              description: 'Pass drills in the Training tab to earn XP and learn how the market actually works. Asset types, risk, valuation — bite-sized lessons.', target: '', position: 'right' },
  { id: 'kickoff',          title: 'Kick off',                     description: 'You’ll get a daily login bonus, weekend sub windows, and quarterly transfer windows. Take it slow — the league runs for 52 weeks.', target: '', position: 'bottom' },
];

// ============================================================
// SEASON / SQUAD / TRANSFER / SNAPSHOT TYPES
// Shared contract for the season-features expansion. Server APIs
// and client store read these constants so caps/costs stay in sync.
// ============================================================

export const SQUAD_STARTER_COUNT = 11;
export const SQUAD_BENCH_COUNT = 11;
export const SQUAD_TOTAL_COUNT = SQUAD_STARTER_COUNT + SQUAD_BENCH_COUNT;

// 52-week global season, with 4 quarters of 13 weeks each
export const SEASON_TOTAL_WEEKS = 52;
export const WEEKS_PER_QUARTER = 13;

// Quarterly transfer windows — open at gameweeks 1, 14, 27, 40 and
// stay open for 2 gameweeks each. New signings only allowed inside.
export const QUARTER_OPEN_GAMEWEEKS = [1, 14, 27, 40] as const;
export const QUARTER_WINDOW_LENGTH_WEEKS = 2;

// Weekend swap window — Fri 16:00 ET (= Fri 21:00 UTC, ignoring DST
// fuzz) through Mon 05:00 UTC ≈ Sun 23:59 ET. Subs only allowed
// inside; outside, the squad is locked.
export const WEEKEND_OPEN_DAY_UTC = 5;       // Friday
export const WEEKEND_OPEN_HOUR_UTC = 21;
export const WEEKEND_CLOSE_DAY_UTC = 1;      // Monday
export const WEEKEND_CLOSE_HOUR_UTC = 5;

// Caps and costs
export const WEEKEND_SUB_MAX_PER_WEEKEND = 4;
export const WEEKEND_SUB_COST_XP = 25;
export const QUARTERLY_TRANSFER_MAX_PER_QUARTER = 5;
export const QUARTERLY_TRANSFER_COST_XP = 100;

export type AllocationStrategy = 'inherit' | 'split';

export interface SeasonState {
  seasonNumber: number;
  startDate: string;          // YYYY-MM-DD (a Monday)
  totalWeeks: number;
  /* Computed: current gameweek 1..52, current quarter 1..4. */
  currentGameweek: number;
  currentQuarter: number;
  isTransferWindowOpen: boolean;
  isWeekendWindowOpen: boolean;
}

export interface WeekendSwap {
  id: string;
  userId: string;
  portfolioId: string;
  gameweek: number;
  seasonNumber: number;
  starterSymbol: string;     // moved to bench
  benchSymbol: string;       // came on
  xpCost: number;
  createdAt: string;
}

export interface TransferLogEntry {
  id: string;
  userId: string;
  portfolioId: string;
  quarter: number;
  seasonNumber: number;
  outSymbol: string;
  inSymbol: string;
  allocationStrategy: AllocationStrategy;
  xpCost: number;
  createdAt: string;
}

export interface PortfolioSnapshot {
  id: string;
  portfolioId: string;
  snapshotDate: string;
  gameweek: number;
  seasonNumber: number;
  players: PortfolioPlayer[];
  formation: Formation;
}

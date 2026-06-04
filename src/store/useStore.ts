'use client';

import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import {
  User,
  Portfolio,
  PortfolioPlayer,
  Formation,
  Activity,
  Notification,
  Asset,
  Challenge,
  ChallengeType,
  ChallengeTimeframe,
  FORMATIONS,
  DEFAULT_MAX_TEAMS,
  TEAM_SLOT_UNLOCK_COST,
  MAX_ACTIVE_CHALLENGES,
  CHALLENGE_XP,
} from '@/types';
import { AuthResponse } from '@/types';

// Simple session storage for current user ID
const SESSION_KEY = 'gamefi_session';

const getStoredSession = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(SESSION_KEY);
};

const setStoredSession = (userId: string | null) => {
  if (typeof window === 'undefined') return;
  if (userId) {
    localStorage.setItem(SESSION_KEY, userId);
  } else {
    localStorage.removeItem(SESSION_KEY);
  }
};

interface AppState {
  // Auth state
  currentUser: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Data
  portfolios: Portfolio[];
  publicPortfolios: Portfolio[];
  activities: Activity[];
  notifications: Notification[];

  // Challenge state
  challenges: Challenge[];
  pendingChallenges: Challenge[];
  activeChallenges: Challenge[];
  completedChallenges: Challenge[];
  challengesLoading: boolean;

  // Training / lesson completion state — set of completed lesson IDs
  lessonCompletions: Set<string>;
  lessonCompletionsLoaded: boolean;

  // Actions - Auth
  login: (identifier: string, password: string) => Promise<AuthResponse>;
  register: (username: string, email: string, password: string) => Promise<AuthResponse>;
  logout: () => void;
  updateProfile: (updates: Partial<User>) => Promise<void>;

  // Actions - Portfolio
  createPortfolio: (name: string, description: string, formation: Formation) => Promise<Portfolio>;
  updatePortfolio: (id: string, updates: Partial<Portfolio>) => Promise<void>;
  deletePortfolio: (id: string) => Promise<void>;
  assignAssetToPosition: (portfolioId: string, positionId: string, asset: Asset | null) => Promise<void>;
  updatePlayerWeights: (portfolioId: string, weights: { positionId: string; allocation: number }[]) => Promise<void>;
  likePortfolio: (portfolioId: string) => Promise<void>;
  clonePortfolio: (portfolioId: string) => Promise<Portfolio | null>;
  canCreateTeam: () => boolean;
  getTeamSlotInfo: () => { current: number; max: number; canUnlock: boolean; unlockCost: number };
  unlockTeamSlot: () => Promise<boolean>;

  // Actions - Social
  followUser: (targetUserId: string) => void;
  unfollowUser: (targetUserId: string) => void;

  // Actions - Notifications
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;

  // Actions - Challenges
  loadChallenges: () => Promise<void>;
  createChallenge: (
    portfolioId: string,
    type: ChallengeType,
    timeframe: ChallengeTimeframe,
    opponentId?: string,
    opponentPortfolioId?: string
  ) => Promise<{ success: boolean; error?: string; challenge?: Challenge }>;
  acceptChallenge: (challengeId: string, portfolioId: string) => Promise<{ success: boolean; error?: string }>;
  declineChallenge: (challengeId: string) => Promise<{ success: boolean; error?: string }>;
  cancelChallenge: (challengeId: string) => Promise<{ success: boolean; error?: string }>;
  getActiveChallengesCount: () => number;
  canCreateChallenge: (type: ChallengeType) => { canCreate: boolean; reason?: string };

  // Actions - Live challenge returns (mid-match percentage refresh)
  loadLiveReturns: () => Promise<void>;

  // Actions - Training / lesson completion
  loadLessonCompletions: () => Promise<void>;
  markLessonComplete: (
    lessonId: string,
    moduleId: string,
  ) => Promise<{
    success: boolean;
    awarded: boolean;
    xpAwarded?: number;
    newLevel?: number;
    leveledUp?: boolean;
    error?: string;
  }>;

  // Actions - Data loading
  loadData: () => Promise<void>;
  refreshPortfolios: () => Promise<void>;
}

export const useStore = create<AppState>((set, get) => ({
  // Initial state
  currentUser: null,
  isAuthenticated: false,
  isLoading: true,
  portfolios: [],
  publicPortfolios: [],
  activities: [],
  notifications: [],
  lessonCompletions: new Set<string>(),
  lessonCompletionsLoaded: false,

  // Challenge initial state
  challenges: [],
  pendingChallenges: [],
  activeChallenges: [],
  completedChallenges: [],
  challengesLoading: false,

  // Auth actions
  login: async (identifier: string, password: string): Promise<AuthResponse> => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      });

      const result: AuthResponse = await response.json();

      if (result.success && result.user) {
        setStoredSession(result.user.id);

        // Fetch user's portfolios
        const portfolioRes = await fetch(`/api/portfolios?userId=${result.user.id}`);
        const portfolioData = await portfolioRes.json();

        set({
          currentUser: result.user,
          isAuthenticated: true,
          portfolios: portfolioData.success ? portfolioData.portfolios : [],
        });
      }

      return result;
    } catch {
      return { success: false, error: 'Login failed. Please try again.' };
    }
  },

  register: async (username: string, email: string, password: string): Promise<AuthResponse> => {
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password }),
      });

      const result = await response.json();

      if (!result.success) {
        return { success: false, error: result.error };
      }

      const { user } = result as { user: User };
      setStoredSession(user.id);

      set({
        currentUser: user,
        isAuthenticated: true,
        portfolios: [],
        notifications: [],
      });

      return { success: true, user };
    } catch {
      return { success: false, error: 'Registration failed. Please try again.' };
    }
  },

  logout: () => {
    setStoredSession(null);
    set({
      currentUser: null,
      isAuthenticated: false,
      portfolios: [],
      notifications: [],
      lessonCompletions: new Set<string>(),
      lessonCompletionsLoaded: false,
    });
  },

  updateProfile: async (updates: Partial<User>) => {
    const { currentUser } = get();
    if (!currentUser) return;

    try {
      const response = await fetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: currentUser.id, ...updates }),
      });

      if (response.ok) {
        const updatedUser = { ...currentUser, ...updates };
        set({ currentUser: updatedUser });
      }
    } catch (error) {
      console.error('Failed to update profile:', error);
    }
  },

  // Portfolio actions
  canCreateTeam: () => {
    const { currentUser, portfolios } = get();
    if (!currentUser) return false;
    const maxTeams = currentUser.maxTeams ?? DEFAULT_MAX_TEAMS;
    return portfolios.length < maxTeams;
  },

  getTeamSlotInfo: () => {
    const { currentUser, portfolios } = get();
    if (!currentUser) {
      return { current: 0, max: DEFAULT_MAX_TEAMS, canUnlock: false, unlockCost: TEAM_SLOT_UNLOCK_COST };
    }
    const maxTeams = currentUser.maxTeams ?? DEFAULT_MAX_TEAMS;
    const canUnlock = currentUser.xp >= TEAM_SLOT_UNLOCK_COST;
    return {
      current: portfolios.length,
      max: maxTeams,
      canUnlock,
      unlockCost: TEAM_SLOT_UNLOCK_COST,
    };
  },

  unlockTeamSlot: async () => {
    const { currentUser } = get();
    if (!currentUser) return false;
    if (currentUser.xp < TEAM_SLOT_UNLOCK_COST) return false;

    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, action: 'unlockTeamSlot' }),
      });

      const result = await response.json();

      if (result.success) {
        const updatedUser = {
          ...currentUser,
          xp: result.xp,
          maxTeams: result.maxTeams,
        };
        set({ currentUser: updatedUser });
        return true;
      }
    } catch (error) {
      console.error('Failed to unlock team slot:', error);
    }

    return false;
  },

  createPortfolio: async (name: string, description: string, formation: Formation) => {
    const { currentUser, canCreateTeam } = get();
    if (!currentUser) throw new Error('Must be logged in');

    if (!canCreateTeam()) {
      throw new Error('Team limit reached. Unlock more slots with XP.');
    }

    const positions = FORMATIONS[formation];
    const players: PortfolioPlayer[] = positions.map((pos) => ({
      positionId: pos.id,
      asset: null,
      allocation: 100 / 11,
    }));

    const response = await fetch('/api/portfolios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: currentUser.id,
        name,
        description,
        formation,
        players,
        isPublic: true,
        tags: [],
      }),
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Failed to create portfolio');
    }

    const portfolio = result.portfolio;

    // Update user XP locally
    const updatedUser = {
      ...currentUser,
      portfolios: [...currentUser.portfolios, portfolio.id],
      xp: currentUser.xp + 50,
    };

    // Update user in database
    await fetch('/api/users', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: currentUser.id, xp: updatedUser.xp }),
    });

    set({
      currentUser: updatedUser,
      portfolios: [...get().portfolios, portfolio],
    });

    return portfolio;
  },

  updatePortfolio: async (id: string, updates: Partial<Portfolio>) => {
    const response = await fetch('/api/portfolios', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...updates }),
    });

    const result = await response.json();

    if (result.success) {
      set({
        portfolios: get().portfolios.map((p) =>
          p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p
        ),
      });
    }
  },

  deletePortfolio: async (id: string) => {
    const { currentUser } = get();
    if (!currentUser) return;

    const response = await fetch(`/api/portfolios?id=${id}`, {
      method: 'DELETE',
    });

    const result = await response.json();

    if (result.success) {
      const updatedUser = {
        ...currentUser,
        portfolios: currentUser.portfolios.filter((pid) => pid !== id),
      };

      set({
        currentUser: updatedUser,
        portfolios: get().portfolios.filter((p) => p.id !== id),
      });
    }
  },

  assignAssetToPosition: async (portfolioId: string, positionId: string, asset: Asset | null) => {
    const portfolio = get().portfolios.find((p) => p.id === portfolioId);
    if (!portfolio) return;

    const updatedPlayers = portfolio.players.map((player) =>
      player.positionId === positionId ? { ...player, asset } : player
    );

    await get().updatePortfolio(portfolioId, { players: updatedPlayers });
  },

  updatePlayerWeights: async (portfolioId: string, weights: { positionId: string; allocation: number }[]) => {
    const portfolio = get().portfolios.find((p) => p.id === portfolioId);
    if (!portfolio) return;

    // Validate total is 100%
    const total = weights.reduce((sum, w) => sum + w.allocation, 0);
    if (Math.abs(total - 100) > 0.1) {
      console.error('Weights must sum to 100%');
      return;
    }

    const updatedPlayers = portfolio.players.map((player) => {
      const weightUpdate = weights.find((w) => w.positionId === player.positionId);
      return weightUpdate ? { ...player, allocation: weightUpdate.allocation } : player;
    });

    await get().updatePortfolio(portfolioId, { players: updatedPlayers });
  },

  likePortfolio: async (portfolioId: string) => {
    const { currentUser } = get();
    if (!currentUser) return;

    // Find portfolio in either user's portfolios or public portfolios
    const portfolio = get().portfolios.find((p) => p.id === portfolioId) ||
                     get().publicPortfolios.find((p) => p.id === portfolioId);
    if (!portfolio) return;

    const hasLiked = portfolio.likes.includes(currentUser.id);
    const updatedLikes = hasLiked
      ? portfolio.likes.filter((id) => id !== currentUser.id)
      : [...portfolio.likes, currentUser.id];

    // Optimistically update locally
    set({
      portfolios: get().portfolios.map((p) =>
        p.id === portfolioId ? { ...p, likes: updatedLikes } : p
      ),
      publicPortfolios: get().publicPortfolios.map((p) =>
        p.id === portfolioId ? { ...p, likes: updatedLikes } : p
      ),
    });

    // Persist to database
    try {
      await fetch('/api/portfolios', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          portfolioId,
          userId: currentUser.id,
          action: 'like',
        }),
      });
    } catch (error) {
      console.error('Failed to persist like:', error);
    }
  },

  clonePortfolio: async (portfolioId: string) => {
    const { currentUser } = get();
    if (!currentUser) return null;

    const original = get().portfolios.find((p) => p.id === portfolioId) ||
                    get().publicPortfolios.find((p) => p.id === portfolioId);
    if (!original) return null;

    const response = await fetch('/api/portfolios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: currentUser.id,
        name: `${original.name} (Clone)`,
        description: original.description,
        formation: original.formation,
        players: original.players,
        isPublic: true,
        tags: original.tags,
      }),
    });

    const result = await response.json();

    if (!result.success) return null;

    const cloned = result.portfolio;

    // Increment clone count on original portfolio
    await fetch('/api/portfolios', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        portfolioId: portfolioId,
        userId: currentUser.id,
        action: 'clone',
      }),
    });

    // Update clone count locally
    set({
      publicPortfolios: get().publicPortfolios.map((p) =>
        p.id === portfolioId ? { ...p, cloneCount: p.cloneCount + 1 } : p
      ),
    });

    const updatedUser = {
      ...currentUser,
      portfolios: [...currentUser.portfolios, cloned.id],
      xp: currentUser.xp + 25,
    };

    await fetch('/api/users', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: currentUser.id, xp: updatedUser.xp }),
    });

    set({
      currentUser: updatedUser,
      portfolios: [...get().portfolios, cloned],
    });

    return cloned;
  },

  // Social actions (these would need API endpoints)
  followUser: (targetUserId: string) => {
    const { currentUser } = get();
    if (!currentUser || currentUser.id === targetUserId) return;

    const updatedCurrentUser = {
      ...currentUser,
      following: [...currentUser.following, targetUserId],
    };

    set({ currentUser: updatedCurrentUser });
  },

  unfollowUser: (targetUserId: string) => {
    const { currentUser } = get();
    if (!currentUser) return;

    const updatedCurrentUser = {
      ...currentUser,
      following: currentUser.following.filter((id) => id !== targetUserId),
    };

    set({ currentUser: updatedCurrentUser });
  },

  // Notification actions
  markNotificationRead: (id: string) => {
    set({
      notifications: get().notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      ),
    });
  },

  markAllNotificationsRead: () => {
    set({
      notifications: get().notifications.map((n) => ({ ...n, read: true })),
    });
  },

  // Challenge actions
  loadChallenges: async () => {
    const { currentUser } = get();
    if (!currentUser) return;

    set({ challengesLoading: true });

    try {
      const response = await fetch(`/api/challenges?userId=${currentUser.id}`);
      const data = await response.json();

      if (data.success) {
        set({
          challenges: data.challenges || [],
          pendingChallenges: data.pendingInvites || [],
          activeChallenges: data.activeChallenges || [],
          completedChallenges: data.completedChallenges || [],
          challengesLoading: false,
        });
      } else {
        set({ challengesLoading: false });
      }
    } catch (error) {
      console.error('Failed to load challenges:', error);
      set({ challengesLoading: false });
    }
  },

  createChallenge: async (
    portfolioId: string,
    type: ChallengeType,
    timeframe: ChallengeTimeframe,
    opponentId?: string,
    opponentPortfolioId?: string
  ) => {
    const { currentUser, canCreateChallenge, loadChallenges } = get();
    if (!currentUser) return { success: false, error: 'Not logged in' };

    const checkResult = canCreateChallenge(type);
    if (!checkResult.canCreate) {
      return { success: false, error: checkResult.reason };
    }

    try {
      const response = await fetch('/api/challenges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengerId: currentUser.id,
          challengerPortfolioId: portfolioId,
          type,
          timeframe,
          opponentId,
          opponentPortfolioId,
        }),
      });

      const data = await response.json();

      if (data.success) {
        await loadChallenges();
        return { success: true, challenge: data.challenge };
      }

      return { success: false, error: data.error };
    } catch (error) {
      console.error('Failed to create challenge:', error);
      return { success: false, error: 'Failed to create challenge' };
    }
  },

  acceptChallenge: async (challengeId: string, portfolioId: string) => {
    const { currentUser, loadChallenges } = get();
    if (!currentUser) return { success: false, error: 'Not logged in' };

    try {
      const response = await fetch('/api/challenges', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeId,
          action: 'accept',
          userId: currentUser.id,
          portfolioId,
        }),
      });

      const data = await response.json();

      if (data.success) {
        await loadChallenges();
        return { success: true };
      }

      return { success: false, error: data.error };
    } catch (error) {
      console.error('Failed to accept challenge:', error);
      return { success: false, error: 'Failed to accept challenge' };
    }
  },

  declineChallenge: async (challengeId: string) => {
    const { currentUser, loadChallenges } = get();
    if (!currentUser) return { success: false, error: 'Not logged in' };

    try {
      const response = await fetch('/api/challenges', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeId,
          action: 'decline',
          userId: currentUser.id,
        }),
      });

      const data = await response.json();

      if (data.success) {
        await loadChallenges();
        return { success: true };
      }

      return { success: false, error: data.error };
    } catch (error) {
      console.error('Failed to decline challenge:', error);
      return { success: false, error: 'Failed to decline challenge' };
    }
  },

  cancelChallenge: async (challengeId: string) => {
    const { currentUser, loadChallenges } = get();
    if (!currentUser) return { success: false, error: 'Not logged in' };

    try {
      const response = await fetch('/api/challenges', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeId,
          action: 'cancel',
          userId: currentUser.id,
        }),
      });

      const data = await response.json();

      if (data.success) {
        await loadChallenges();
        return { success: true };
      }

      return { success: false, error: data.error };
    } catch (error) {
      console.error('Failed to cancel challenge:', error);
      return { success: false, error: 'Failed to cancel challenge' };
    }
  },

  getActiveChallengesCount: () => {
    const { challenges, currentUser } = get();
    if (!currentUser) return 0;

    return challenges.filter(
      (c) =>
        (c.status === 'pending' || c.status === 'active') &&
        (c.challengerId === currentUser.id || c.opponentId === currentUser.id)
    ).length;
  },

  canCreateChallenge: (type: ChallengeType) => {
    const { currentUser, getActiveChallengesCount } = get();
    if (!currentUser) {
      return { canCreate: false, reason: 'Not logged in' };
    }

    const activeCount = getActiveChallengesCount();
    if (activeCount >= MAX_ACTIVE_CHALLENGES) {
      return {
        canCreate: false,
        reason: `Maximum ${MAX_ACTIVE_CHALLENGES} active challenges allowed`,
      };
    }

    const requiredXp = type === 'sp500' ? CHALLENGE_XP.VS_SP500 : CHALLENGE_XP.VS_USER;
    if (currentUser.xp < requiredXp) {
      return {
        canCreate: false,
        reason: `Need ${requiredXp} XP to cover potential loss`,
      };
    }

    return { canCreate: true };
  },

  // Data loading
  loadLiveReturns: async () => {
    const { currentUser, challenges, activeChallenges } = get();
    if (!currentUser || activeChallenges.length === 0) return;

    try {
      const res = await fetch(`/api/challenges/live?userId=${currentUser.id}`);
      const data = await res.json();
      if (!data.success || !data.live) return;

      const liveMap: Record<
        string,
        { challengerReturnPercent: number; opponentReturnPercent: number }
      > = data.live;

      /* Merge the live numbers into both the master `challenges` array
         and the derived `activeChallenges` slice so any consumer
         (Fixtures page, Dashboard Live Fixtures) picks them up. */
      const merge = (c: Challenge): Challenge => {
        const live = liveMap[c.id];
        if (!live) return c;
        return {
          ...c,
          challengerReturnPercent: live.challengerReturnPercent,
          opponentReturnPercent: live.opponentReturnPercent,
        };
      };

      set({
        challenges: challenges.map(merge),
        activeChallenges: activeChallenges.map(merge),
      });
    } catch (error) {
      console.error('Failed to load live returns:', error);
    }
  },

  loadLessonCompletions: async () => {
    const { currentUser } = get();
    if (!currentUser) {
      set({ lessonCompletions: new Set<string>(), lessonCompletionsLoaded: true });
      return;
    }

    try {
      const res = await fetch(`/api/training/completions?userId=${currentUser.id}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.completions)) {
        set({
          lessonCompletions: new Set<string>(data.completions.map((c: { lessonId: string }) => c.lessonId)),
          lessonCompletionsLoaded: true,
        });
      } else {
        set({ lessonCompletionsLoaded: true });
      }
    } catch (error) {
      console.error('Failed to load lesson completions:', error);
      set({ lessonCompletionsLoaded: true });
    }
  },

  markLessonComplete: async (lessonId: string, moduleId: string) => {
    const { currentUser, lessonCompletions } = get();
    if (!currentUser) {
      return { success: false, awarded: false, error: 'Not logged in' };
    }

    /* Optimistically mark complete in local state so the UI doesn't lag
       behind the network round-trip. If the server fails, we roll back. */
    const alreadyComplete = lessonCompletions.has(lessonId);
    if (!alreadyComplete) {
      const optimistic = new Set(lessonCompletions);
      optimistic.add(lessonId);
      set({ lessonCompletions: optimistic });
    }

    try {
      const res = await fetch('/api/training/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          lessonId,
          moduleId,
        }),
      });
      const data = await res.json();

      if (!data.success) {
        /* Rollback optimistic update on failure. */
        if (!alreadyComplete) {
          const rollback = new Set(get().lessonCompletions);
          rollback.delete(lessonId);
          set({ lessonCompletions: rollback });
        }
        return { success: false, awarded: false, error: data.error };
      }

      /* Bump currentUser xp/level locally on first-time completion so
         sidebar / topbar / dashboard reflect the award immediately. */
      if (data.awarded && data.newXp !== undefined) {
        const cur = get().currentUser;
        if (cur) {
          set({
            currentUser: {
              ...cur,
              xp: data.newXp,
              level: data.newLevel ?? cur.level,
            },
          });
        }
      }

      return {
        success: true,
        awarded: !!data.awarded,
        xpAwarded: data.xpAwarded,
        newLevel: data.newLevel,
        leveledUp: !!data.leveledUp,
      };
    } catch (error) {
      console.error('Failed to mark lesson complete:', error);
      if (!alreadyComplete) {
        const rollback = new Set(get().lessonCompletions);
        rollback.delete(lessonId);
        set({ lessonCompletions: rollback });
      }
      return { success: false, awarded: false, error: 'Network error' };
    }
  },

  loadData: async () => {
    const sessionUserId = getStoredSession();

    if (!sessionUserId) {
      set({ isLoading: false, isAuthenticated: false });
      return;
    }

    try {
      // Fetch user data
      const userRes = await fetch(`/api/users?id=${sessionUserId}`);
      const userData = await userRes.json();

      if (!userData.success) {
        setStoredSession(null);
        set({ isLoading: false, isAuthenticated: false });
        return;
      }

      // Fetch user's portfolios
      const portfolioRes = await fetch(`/api/portfolios?userId=${sessionUserId}`);
      const portfolioData = await portfolioRes.json();

      // Fetch public portfolios
      const publicRes = await fetch('/api/portfolios');
      const publicData = await publicRes.json();

      // Fetch challenges + training completions in parallel
      const [challengesRes, completionsRes] = await Promise.all([
        fetch(`/api/challenges?userId=${sessionUserId}`),
        fetch(`/api/training/completions?userId=${sessionUserId}`),
      ]);
      const challengesData = await challengesRes.json();
      const completionsData = await completionsRes.json().catch(() => ({ success: false }));

      set({
        currentUser: userData.user,
        isAuthenticated: true,
        isLoading: false,
        portfolios: portfolioData.success ? portfolioData.portfolios : [],
        publicPortfolios: publicData.success ? publicData.portfolios : [],
        challenges: challengesData.success ? challengesData.challenges : [],
        pendingChallenges: challengesData.success ? challengesData.pendingInvites : [],
        activeChallenges: challengesData.success ? challengesData.activeChallenges : [],
        completedChallenges: challengesData.success ? challengesData.completedChallenges : [],
        lessonCompletions: completionsData.success
          ? new Set<string>(completionsData.completions.map((c: { lessonId: string }) => c.lessonId))
          : new Set<string>(),
        lessonCompletionsLoaded: true,
      });
    } catch (error) {
      console.error('Failed to load data:', error);
      setStoredSession(null);
      set({ isLoading: false, isAuthenticated: false });
    }
  },

  refreshPortfolios: async () => {
    const { currentUser } = get();
    if (!currentUser) return;

    try {
      const portfolioRes = await fetch(`/api/portfolios?userId=${currentUser.id}`);
      const portfolioData = await portfolioRes.json();

      const publicRes = await fetch('/api/portfolios');
      const publicData = await publicRes.json();

      set({
        portfolios: portfolioData.success ? portfolioData.portfolios : [],
        publicPortfolios: publicData.success ? publicData.portfolios : [],
      });
    } catch (error) {
      console.error('Failed to refresh portfolios:', error);
    }
  },
}));

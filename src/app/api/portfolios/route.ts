import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '@/lib/supabase';
import { requireSessionUserId } from '@/lib/session';
import { Portfolio, Formation, PortfolioPlayer } from '@/types';

// GET - Fetch portfolios (optionally by user_id)
/* GET — Fetch portfolios (optionally by user_id, or a single by ?id=X).
   When ?id=X is supplied with ?viewerId=Y the F7 privacy gate applies:
   - viewerId missing or === owner → live data
   - viewerId !== owner → swap in latest portfolio_snapshots row + flag
     isSnapshot=true. If no snapshot exists yet, return live with
     noSnapshotAvailable=true. */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const portfolioId = searchParams.get('id');
    const viewerId = searchParams.get('viewerId');

    let query = supabase.from('portfolios').select('*');

    if (portfolioId) {
      query = query.eq('id', portfolioId);
    } else if (userId) {
      query = query.eq('user_id', userId);
    } else {
      // Return public portfolios
      query = query.eq('is_public', true);
    }

    const { data: portfolios, error } = await query;

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // Convert to app format
    const formattedPortfolios: Portfolio[] = portfolios.map(p => ({
      id: p.id,
      userId: p.user_id,
      name: p.name,
      description: p.description,
      formation: p.formation as Formation,
      players: typeof p.players === 'string' ? JSON.parse(p.players) : p.players,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
      isPublic: p.is_public,
      likes: [],
      clonedFrom: p.cloned_from,
      cloneCount: p.clone_count,
      tags: p.tags || [],
    }));

    /* Likes: one batched query keyed on portfolio_id IN (…). Replaces
       the N+1 loop that fired one SELECT per portfolio (Sprint 5,
       item 25). Skip if there's only one portfolio — single query is
       fine and the detail-page case stays cheap. */
    if (formattedPortfolios.length === 1) {
      const { data: likes } = await supabase
        .from('portfolio_likes')
        .select('user_id')
        .eq('portfolio_id', formattedPortfolios[0].id);
      formattedPortfolios[0].likes = likes?.map((l) => l.user_id) || [];
    } else if (formattedPortfolios.length > 1) {
      const ids = formattedPortfolios.map((p) => p.id);
      const { data: likes } = await supabase
        .from('portfolio_likes')
        .select('portfolio_id, user_id')
        .in('portfolio_id', ids);
      const grouped = new Map<string, string[]>();
      for (const row of likes || []) {
        const arr = grouped.get(row.portfolio_id) || [];
        arr.push(row.user_id);
        grouped.set(row.portfolio_id, arr);
      }
      for (const p of formattedPortfolios) {
        p.likes = grouped.get(p.id) || [];
      }
    }

    // F7 privacy gate: single portfolio + viewerId who isn't the owner →
    // swap in latest snapshot players/formation, flag isSnapshot.
    if (portfolioId && viewerId && formattedPortfolios.length > 0) {
      const portfolio = formattedPortfolios[0];
      if (viewerId !== portfolio.userId) {
        const { data: snapshotRow } = await supabase
          .from('portfolio_snapshots')
          .select('players, formation, gameweek')
          .eq('portfolio_id', portfolio.id)
          .order('gameweek', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (snapshotRow) {
          portfolio.players = typeof snapshotRow.players === 'string'
            ? JSON.parse(snapshotRow.players)
            : (snapshotRow.players || []);
          portfolio.formation = snapshotRow.formation as Formation;
          portfolio.isSnapshot = true;
          portfolio.snapshotGameweek = snapshotRow.gameweek;
        } else {
          portfolio.isSnapshot = false;
          portfolio.noSnapshotAvailable = true;
        }
      }
    }

    return NextResponse.json({ success: true, portfolios: formattedPortfolios });
  } catch (error) {
    console.error('Fetch portfolios error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch portfolios' }, { status: 500 });
  }
}

// POST - Create a new portfolio
//
// Awards XP server-side based on whether this is a fresh creation
// (+50) or a clone (+25, signaled by clonedFrom). Previously the
// client called PUT /api/users to set its own XP after create — which
// meant anyone could grant themselves arbitrary XP. Now the only
// portfolio-creation XP path is here.
const PORTFOLIO_CREATE_XP = 50;
const PORTFOLIO_CLONE_XP = 25;

function levelForXp(xp: number): number {
  if (xp < 1000) return 1;
  if (xp < 3000) return 2;
  if (xp < 5000) return 3;
  if (xp < 10000) return 4;
  return 5;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, name, description, formation, players, isPublic, tags, clonedFrom } = body;

    if (!name || !formation) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    /* Auth: portfolio is always created for the session user. Body
       userId optional but must match session if present. */
    const sessionResult = requireSessionUserId(request, userId);
    if (sessionResult instanceof NextResponse) return sessionResult;
    const sessionUserId = sessionResult;

    // Check user's team limit
    const { data: user } = await supabase
      .from('users')
      .select('max_teams')
      .eq('id', sessionUserId)
      .single();

    const { data: existingPortfolios } = await supabase
      .from('portfolios')
      .select('id')
      .eq('user_id', sessionUserId);

    const maxTeams = user?.max_teams || 3;
    if (existingPortfolios && existingPortfolios.length >= maxTeams) {
      return NextResponse.json(
        { success: false, error: 'Squad limit reached. Unlock more slots with XP.' },
        { status: 400 }
      );
    }

    const portfolioId = uuidv4();
    const now = new Date().toISOString();

    const { data: newPortfolio, error } = await supabase
      .from('portfolios')
      .insert({
        id: portfolioId,
        user_id: sessionUserId,
        name,
        description: description || '',
        formation,
        players: JSON.stringify(players || []),
        is_public: isPublic !== false,
        tags: tags || [],
        cloned_from: clonedFrom || null,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    /* Award XP for the creation. Fresh = +50, clone = +25. Server-side
       so the client can't forge its own grant. Updates returned in the
       response so the store can sync currentUser without a refetch. */
    const xpDelta = clonedFrom ? PORTFOLIO_CLONE_XP : PORTFOLIO_CREATE_XP;
    let newXp: number | null = null;
    let newLevel: number | null = null;
    if (xpDelta > 0) {
      const { data: cur } = await supabase
        .from('users')
        .select('xp')
        .eq('id', sessionUserId)
        .single();
      const baseXp = cur?.xp ?? 0;
      const nextXp = baseXp + xpDelta;
      newXp = nextXp;
      newLevel = levelForXp(nextXp);
      const { error: xpErr } = await supabase
        .from('users')
        .update({ xp: nextXp, level: newLevel, updated_at: now })
        .eq('id', sessionUserId);
      if (xpErr) console.error('Failed to grant portfolio-create XP:', xpErr);
    }

    const portfolio: Portfolio = {
      id: newPortfolio.id,
      userId: newPortfolio.user_id,
      name: newPortfolio.name,
      description: newPortfolio.description,
      formation: newPortfolio.formation as Formation,
      players: typeof newPortfolio.players === 'string'
        ? JSON.parse(newPortfolio.players)
        : newPortfolio.players,
      createdAt: newPortfolio.created_at,
      updatedAt: newPortfolio.updated_at,
      isPublic: newPortfolio.is_public,
      likes: [],
      clonedFrom: newPortfolio.cloned_from,
      cloneCount: newPortfolio.clone_count,
      tags: newPortfolio.tags || [],
    };

    return NextResponse.json({
      success: true,
      portfolio,
      /* Caller merges these into currentUser so XP/level stay in sync
         without a separate /api/users fetch. */
      xpAwarded: xpDelta,
      newXp,
      newLevel,
    });
  } catch (error) {
    console.error('Create portfolio error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create portfolio' }, { status: 500 });
  }
}

// PUT - Update a portfolio
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, userId: bodyUserId, name, description, formation, players, isPublic, tags } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Portfolio ID required' }, { status: 400 });
    }

    /* Ownership check. The signed session cookie (decoded by middleware
       into the x-session-user-id header) is the source of truth. We
       still accept a body userId as a fallback for the migration
       window but reject it if it doesn't match the session. */
    const sessionUserId = request.headers.get('x-session-user-id');
    const userId = sessionUserId || bodyUserId;
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthenticated — session required.' },
        { status: 401 },
      );
    }
    if (sessionUserId && bodyUserId && sessionUserId !== bodyUserId) {
      return NextResponse.json(
        { success: false, error: 'Session userId does not match request userId.' },
        { status: 403 },
      );
    }
    {
      const { data: owned, error: ownErr } = await supabase
        .from('portfolios')
        .select('user_id')
        .eq('id', id)
        .single();
      if (ownErr || !owned) {
        return NextResponse.json({ success: false, error: 'Portfolio not found' }, { status: 404 });
      }
      if (owned.user_id !== userId) {
        return NextResponse.json(
          { success: false, error: 'Not authorized to update this portfolio' },
          { status: 403 },
        );
      }
    }

    /* One-ticker-per-squad rule: reject if the incoming players array
       contains the same ticker on two different slots. Existing legacy
       portfolios with dupes aren't auto-cleaned — but no future PUT
       can introduce or perpetuate one. */
    if (Array.isArray(players)) {
      const seen = new Map<string, string>();
      for (const p of players) {
        const sym = p?.asset?.symbol?.toUpperCase?.();
        if (!sym) continue;
        if (seen.has(sym) && seen.get(sym) !== p.positionId) {
          return NextResponse.json(
            { success: false, error: `${sym} is in this squad twice. Each ticker can only be signed once.` },
            { status: 400 },
          );
        }
        seen.set(sym, p.positionId);
      }
    }

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (formation !== undefined) updateData.formation = formation;
    if (players !== undefined) updateData.players = JSON.stringify(players);
    if (isPublic !== undefined) updateData.is_public = isPublic;
    if (tags !== undefined) updateData.tags = tags;

    const { data: updated, error } = await supabase
      .from('portfolios')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const portfolio: Portfolio = {
      id: updated.id,
      userId: updated.user_id,
      name: updated.name,
      description: updated.description,
      formation: updated.formation as Formation,
      players: typeof updated.players === 'string' ? JSON.parse(updated.players) : updated.players,
      createdAt: updated.created_at,
      updatedAt: updated.updated_at,
      isPublic: updated.is_public,
      likes: [],
      clonedFrom: updated.cloned_from,
      cloneCount: updated.clone_count,
      tags: updated.tags || [],
    };

    return NextResponse.json({ success: true, portfolio });
  } catch (error) {
    console.error('Update portfolio error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update portfolio' }, { status: 500 });
  }
}

// PATCH - Toggle like on a portfolio
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { portfolioId, userId, action } = body;

    if (!portfolioId || !userId) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    if (action === 'like') {
      // Check if already liked
      const { data: existingLike } = await supabase
        .from('portfolio_likes')
        .select('*')
        .eq('portfolio_id', portfolioId)
        .eq('user_id', userId)
        .single();

      if (existingLike) {
        // Unlike - remove the like
        await supabase
          .from('portfolio_likes')
          .delete()
          .eq('portfolio_id', portfolioId)
          .eq('user_id', userId);
      } else {
        // Like - add the like
        await supabase
          .from('portfolio_likes')
          .insert({
            portfolio_id: portfolioId,
            user_id: userId,
            created_at: new Date().toISOString(),
          });
      }

      // Get updated likes count
      const { data: likes } = await supabase
        .from('portfolio_likes')
        .select('user_id')
        .eq('portfolio_id', portfolioId);

      return NextResponse.json({
        success: true,
        likes: likes?.map(l => l.user_id) || [],
        liked: !existingLike
      });
    }

    if (action === 'clone') {
      // Increment clone count
      const { data: portfolio } = await supabase
        .from('portfolios')
        .select('clone_count')
        .eq('id', portfolioId)
        .single();

      await supabase
        .from('portfolios')
        .update({ clone_count: (portfolio?.clone_count || 0) + 1 })
        .eq('id', portfolioId);

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Portfolio action error:', error);
    return NextResponse.json({ success: false, error: 'Failed to perform action' }, { status: 500 });
  }
}

// DELETE - Delete a portfolio
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Portfolio ID required' }, { status: 400 });
    }

    const { error } = await supabase.from('portfolios').delete().eq('id', id);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete portfolio error:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete portfolio' }, { status: 500 });
  }
}

'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { AppLayout, Input } from '@/components';
import { MOCK_ASSETS, SECTORS, getAllAssets, addExternalAsset } from '@/data/assets';
import { formatCurrency, formatPercent, formatNumber } from '@/lib/utils';
import { useAssetSearch } from '@/hooks/useAssetSearch';
import { Asset } from '@/types';
import { Icon } from '@/components/stadium/Icon';

type SortBy = 'name' | 'price' | 'change' | 'marketCap';
type SortOrder = 'asc' | 'desc';

/* Map beta to a soccer-position risk tier:
   DEF (defender)   – low-volatility, beta < 0.9  → "the back four"
   MID (midfielder) – balanced, 0.9 ≤ beta < 1.3  → "the engine room"
   ATK (attacker)   – high-volatility, beta ≥ 1.3 → "go score goals" */
type RiskTier = 'DEF' | 'MID' | 'ATK';
const riskTier = (beta: number): RiskTier => {
  if (beta < 0.9) return 'DEF';
  if (beta < 1.3) return 'MID';
  return 'ATK';
};
const riskPillClass = (tier: RiskTier) =>
  tier === 'ATK' ? 'pill pill-red' : tier === 'MID' ? 'pill pill-whistle' : 'pill pill-sky';

export default function MarketPage() {
  const [selectedSector, setSelectedSector] = useState('All');
  const [sortBy, setSortBy] = useState<SortBy>('marketCap');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const { results: searchResults, isLoading: isSearching, error: searchError, searchTerm, setSearchTerm } = useAssetSearch('');

  const filteredAssets = useMemo(() => {
    let assets: Asset[] = searchTerm.trim() ? searchResults : getAllAssets();

    if (selectedSector !== 'All') {
      assets = assets.filter((a) => a.sector === selectedSector);
    }

    assets = [...assets].sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case 'name': cmp = a.name.localeCompare(b.name); break;
        case 'price': cmp = a.currentPrice - b.currentPrice; break;
        case 'change': cmp = a.dayChangePercent - b.dayChangePercent; break;
        case 'marketCap': cmp = a.marketCap - b.marketCap; break;
      }
      return sortOrder === 'asc' ? cmp : -cmp;
    });

    return assets;
  }, [searchTerm, searchResults, selectedSector, sortBy, sortOrder]);

  const marketStats = useMemo(() => {
    const allAssets = getAllAssets();
    const gainers = allAssets.filter((a) => a.dayChangePercent > 0).length;
    const losers = allAssets.filter((a) => a.dayChangePercent < 0).length;
    const avgChange = allAssets.reduce((sum, a) => sum + a.dayChangePercent, 0) / allAssets.length;
    const totalMarketCap = allAssets.reduce((sum, a) => sum + a.marketCap, 0);
    return { gainers, losers, avgChange, totalMarketCap, totalAssets: allAssets.length };
  }, []);

  const handleSort = (field: SortBy) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const handleAssetView = (asset: Asset) => {
    const isExternal = !MOCK_ASSETS.some((a) => a.id === asset.id);
    if (isExternal) addExternalAsset(asset);
  };

  // Top 4 movers for the "Hot Transfers" featured row
  const hotMovers = useMemo(() => {
    const allAssets = getAllAssets();
    return [...allAssets]
      .sort((a, b) => Math.abs(b.dayChangePercent) - Math.abs(a.dayChangePercent))
      .slice(0, 4);
  }, []);

  return (
    <AppLayout flush>
      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between" style={{ gap: 14 }}>
          <div>
            <div className="kicker">{marketStats.totalAssets}+ TICKERS · LIVE PRICING</div>
            <h1
              className="display"
              style={{ fontSize: 'clamp(24px, 3vw, 32px)', letterSpacing: '-0.04em', margin: '2px 0 0' }}
            >
              Transfer Market
            </h1>
            <div className="mono" style={{ fontSize: 12, color: 'var(--text-mute)', marginTop: 6 }}>
              Browse, search, and sign new players for your squads.
            </div>
          </div>
        </div>

        {/* Market stats row */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 12,
          }}
        >
          <StatTile kicker="TOTAL TICKERS" value={String(marketStats.totalAssets)} />
          <StatTile
            kicker="GAINERS / LOSERS"
            value={
              <>
                <span style={{ color: 'var(--pitch)' }}>{marketStats.gainers}</span>
                <span style={{ color: 'var(--text-mute)' }}> / </span>
                <span style={{ color: 'var(--ref-red)' }}>{marketStats.losers}</span>
              </>
            }
          />
          <StatTile
            kicker="AVG CHANGE"
            value={formatPercent(marketStats.avgChange)}
            tone={marketStats.avgChange >= 0 ? 'pos' : 'neg'}
          />
          <StatTile kicker="MARKET CAP" value={`$${formatNumber(marketStats.totalMarketCap)}`} />
        </div>

        {/* Search + sector filter */}
        <div className="flex flex-wrap" style={{ gap: 10, alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <Input
              placeholder="Scout a ticker (e.g. NVDA, COIN, PLTR)…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              leftIcon={
                isSearching ? (
                  <div
                    style={{
                      width: 14,
                      height: 14,
                      border: '2px solid var(--line)',
                      borderTopColor: 'var(--pitch)',
                      borderRadius: '50%',
                      animation: 'stadium-spin 0.9s linear infinite',
                    }}
                  />
                ) : (
                  <Icon.Search size={14} />
                )
              }
            />
          </div>
          <div className="flex" style={{ gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span className="kicker" style={{ marginRight: 4 }}>SORT</span>
            {(
              [
                ['change', 'Today'],
                ['marketCap', 'Cap'],
                ['price', 'Price'],
                ['name', 'Name'],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => handleSort(k)}
                className="mono"
                style={{
                  padding: '6px 10px',
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  background: sortBy === k ? 'var(--pitch)' : 'transparent',
                  color: sortBy === k ? 'oklch(0.14 0.05 145)' : 'var(--text-dim)',
                  border: '1px solid ' + (sortBy === k ? 'var(--pitch-deep)' : 'var(--line)'),
                  borderRadius: 4,
                  cursor: 'pointer',
                }}
              >
                {label} {sortBy === k ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
              </button>
            ))}
          </div>
        </div>

        {/* Sector chips */}
        <div className="flex flex-wrap" style={{ gap: 6 }}>
          {['All', ...SECTORS].map((sector) => (
            <button
              key={sector}
              type="button"
              onClick={() => setSelectedSector(sector)}
              className="mono"
              style={{
                padding: '6px 12px',
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                background: selectedSector === sector ? 'var(--text)' : 'var(--surface)',
                color: selectedSector === sector ? 'var(--bg)' : 'var(--text-dim)',
                border: '1px solid ' + (selectedSector === sector ? 'var(--text)' : 'var(--line)'),
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              {sector}
            </button>
          ))}
        </div>

        {/* Hot transfers featured row */}
        {!searchTerm.trim() && hotMovers.length > 0 && (
          <div>
            <div className="kicker" style={{ marginBottom: 10 }}>HOT TRANSFERS</div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 10,
              }}
            >
              {hotMovers.map((s) => (
                <TransferCard key={s.id} asset={s} />
              ))}
            </div>
          </div>
        )}

        {searchError && (
          <div
            className="stadium-card"
            style={{
              padding: 12,
              borderColor: 'oklch(0.65 0.22 25 / 0.3)',
              background: 'oklch(0.65 0.22 25 / 0.08)',
            }}
          >
            <p style={{ fontSize: 12, color: 'var(--ref-red)', margin: 0 }}>{searchError}</p>
          </div>
        )}

        {searchTerm.trim() && filteredAssets.length === 0 && !isSearching && !searchError && (
          <div className="stadium-card" style={{ padding: 12 }}>
            <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: 0 }}>
              No matches found. Try a valid stock ticker (e.g., PLTR, TSLA) to search Yahoo Finance.
            </p>
          </div>
        )}

        {/* Roster table */}
        <div className="stadium-card" style={{ overflow: 'hidden' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(220px, 2.5fr) 110px 80px 100px 100px 100px 90px',
              padding: '10px 16px',
              background: 'var(--surface-2)',
              borderBottom: '1px solid var(--line)',
              gap: 12,
            }}
          >
            <SortHeader label="TICKER · NAME" active={sortBy === 'name'} order={sortOrder} onClick={() => handleSort('name')} />
            <div className="kicker" style={{ fontSize: 9 }}>SECTOR</div>
            <div className="kicker" style={{ fontSize: 9 }}>RISK</div>
            <SortHeader label="PRICE" active={sortBy === 'price'} order={sortOrder} onClick={() => handleSort('price')} align="right" />
            <SortHeader label="TODAY" active={sortBy === 'change'} order={sortOrder} onClick={() => handleSort('change')} align="right" />
            <SortHeader label="MARKET CAP" active={sortBy === 'marketCap'} order={sortOrder} onClick={() => handleSort('marketCap')} align="right" />
            <div className="kicker" style={{ fontSize: 9, textAlign: 'right' }}>ACTION</div>
          </div>

          {isSearching && searchTerm.trim() && (
            <div style={{ padding: 48, textAlign: 'center' }}>
              <div className="stadium-spinner" style={{ margin: '0 auto 12px', width: 32, height: 32 }} />
              <div className="kicker">SEARCHING FOR “{searchTerm}”…</div>
            </div>
          )}

          {!isSearching && filteredAssets.length === 0 && (
            <div className="kicker" style={{ padding: 48, textAlign: 'center' }}>
              NO TICKERS MATCH THIS FILTER
            </div>
          )}

          {!isSearching &&
            filteredAssets.map((asset, i) => {
              const isExternal = !MOCK_ASSETS.some((a) => a.id === asset.id);
              if (isExternal) handleAssetView(asset);
              const up = asset.dayChangePercent >= 0;
              const tier = riskTier(asset.beta || 1);
              return (
                <div
                  key={asset.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(220px, 2.5fr) 110px 80px 100px 100px 100px 90px',
                    padding: '12px 16px',
                    alignItems: 'center',
                    borderTop: i === 0 ? 'none' : '1px solid var(--line)',
                    gap: 12,
                    transition: 'background .12s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-2)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <div className="flex items-center" style={{ gap: 12, minWidth: 0 }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 6,
                        background: 'var(--surface-2)',
                        border: '1px solid var(--line)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        fontFamily: 'var(--font-display)',
                        fontWeight: 700,
                        fontSize: 12,
                        color: 'var(--pitch)',
                        letterSpacing: '-0.02em',
                      }}
                    >
                      {asset.symbol.slice(0, 3)}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div className="flex items-center" style={{ gap: 6 }}>
                        <span
                          className="display num"
                          style={{ fontSize: 14, color: 'var(--text)', letterSpacing: '-0.02em' }}
                        >
                          {asset.symbol}
                        </span>
                        <span className="pill" style={{ padding: '1px 5px', fontSize: 9 }}>
                          {asset.type.toUpperCase()}
                        </span>
                        {isExternal && (
                          <span className="pill pill-sky" style={{ padding: '1px 5px', fontSize: 9 }}>
                            YAHOO
                          </span>
                        )}
                      </div>
                      <div
                        className="mono"
                        style={{
                          fontSize: 11,
                          color: 'var(--text-mute)',
                          marginTop: 1,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {asset.name}
                      </div>
                    </div>
                  </div>
                  <div className="mono" style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                    {asset.sector.toUpperCase()}
                  </div>
                  <div>
                    <span className={riskPillClass(tier)} style={{ padding: '2px 6px' }}>
                      {tier}
                    </span>
                  </div>
                  <div className="mono num" style={{ fontSize: 12, textAlign: 'right' }}>
                    {formatCurrency(asset.currentPrice)}
                  </div>
                  <div
                    className="mono num"
                    style={{
                      fontSize: 12,
                      textAlign: 'right',
                      fontWeight: 700,
                      color: up ? 'var(--pitch)' : 'var(--ref-red)',
                    }}
                  >
                    {formatPercent(asset.dayChangePercent)}
                  </div>
                  <div
                    className="mono"
                    style={{
                      fontSize: 12,
                      textAlign: 'right',
                      color: 'var(--text-dim)',
                    }}
                  >
                    ${formatNumber(asset.marketCap)}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <Link
                      href="/portfolio"
                      className="stadium-btn stadium-btn-ghost"
                      style={{
                        padding: '5px 10px',
                        fontSize: 10,
                        textDecoration: 'none',
                      }}
                      title={`Sign ${asset.symbol} to a squad`}
                    >
                      <Icon.Plus size={11} /> Sign
                    </Link>
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </AppLayout>
  );
}

const SortHeader: React.FC<{
  label: string;
  active: boolean;
  order: SortOrder;
  onClick: () => void;
  align?: 'left' | 'right';
}> = ({ label, active, order, onClick, align = 'left' }) => (
  <button
    type="button"
    onClick={onClick}
    className="kicker"
    style={{
      display: 'flex',
      gap: 4,
      alignItems: 'center',
      justifyContent: align === 'right' ? 'flex-end' : 'flex-start',
      background: 'transparent',
      border: 'none',
      cursor: 'pointer',
      color: active ? 'var(--pitch)' : 'var(--text-mute)',
      fontSize: 9,
      padding: 0,
    }}
  >
    {label}
    {active && <span>{order === 'asc' ? '↑' : '↓'}</span>}
  </button>
);

const StatTile: React.FC<{
  kicker: string;
  value: React.ReactNode;
  tone?: 'pos' | 'neg';
}> = ({ kicker, value, tone }) => (
  <div className="stadium-card" style={{ padding: 14 }}>
    <div className="kicker">{kicker}</div>
    <div
      className="display num"
      style={{
        fontSize: 22,
        letterSpacing: '-0.04em',
        marginTop: 4,
        color: tone === 'pos' ? 'var(--pitch)' : tone === 'neg' ? 'var(--ref-red)' : 'var(--text)',
      }}
    >
      {value}
    </div>
  </div>
);

const TransferCard: React.FC<{ asset: Asset }> = ({ asset }) => {
  const up = asset.dayChangePercent >= 0;
  const tier = riskTier(asset.beta || 1);
  return (
    <div
      className="stadium-card"
      style={{
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        transition: 'border-color .15s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--pitch)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--line)';
      }}
    >
      <div className="flex justify-between" style={{ alignItems: 'flex-start' }}>
        <div>
          <div className="display num" style={{ fontSize: 18, letterSpacing: '-0.04em' }}>
            {asset.symbol}
          </div>
          <div className="mono" style={{ fontSize: 10, color: 'var(--text-mute)' }}>
            {asset.sector.toUpperCase()}
          </div>
        </div>
        <span className={riskPillClass(tier)} style={{ padding: '2px 6px' }}>
          {tier}
        </span>
      </div>
      <div>
        <div
          className="display num"
          style={{
            fontSize: 20,
            color: up ? 'var(--pitch)' : 'var(--ref-red)',
            letterSpacing: '-0.03em',
          }}
        >
          {formatPercent(asset.dayChangePercent)}
          <span
            style={{ fontSize: 12, marginLeft: 8, color: 'var(--text-mute)', fontWeight: 500 }}
          >
            {up ? '▲' : '▼'} today
          </span>
        </div>
        <div className="mono num" style={{ fontSize: 11, color: 'var(--text-dim)' }}>
          {formatCurrency(asset.currentPrice)}
        </div>
      </div>
      <Link
        href="/portfolio"
        className="stadium-btn stadium-btn-ink"
        style={{
          width: '100%',
          justifyContent: 'center',
          padding: '8px 12px',
          fontSize: 12,
          textDecoration: 'none',
          marginTop: 'auto',
        }}
      >
        Sign {asset.symbol}
      </Link>
    </div>
  );
};

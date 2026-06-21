'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Asset, Position, POSITION_RISK_MAP, RiskLevel, getAssetRiskLevel } from '@/types';
import { MOCK_ASSETS, SECTORS, addExternalAsset } from '@/data/assets';
import { formatCurrency, formatPercent } from '@/lib/utils';
import { Input, Modal } from '@/components/ui';
import { useAssetSearch } from '@/hooks/useAssetSearch';
import { Icon } from '@/components/stadium/Icon';

/* Map portfolio risk tier → stadium DEF/MID/ATK colour vocabulary. */
const RISK_CONFIG: Record<RiskLevel, { code: 'DEF' | 'MID' | 'ATK'; pillClass: string; color: string; label: string }> = {
  low:    { code: 'DEF', pillClass: 'pill pill-sky',     color: 'oklch(0.75 0.14 230)', label: 'Defender · low volatility' },
  medium: { code: 'MID', pillClass: 'pill pill-whistle', color: 'oklch(0.83 0.18 90)',  label: 'Midfielder · balanced'      },
  high:   { code: 'ATK', pillClass: 'pill pill-red',     color: 'oklch(0.65 0.22 25)',  label: 'Attacker · high volatility' },
};

interface AssetSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  /* Default mode: just returns the picked asset (or null to release).
     In signingMode the modal shows a small "signing" notice explaining
     that the new player takes the outgoing player's slot/weight (the
     allocation strategy used to live here but moved to the Sub Off
     modal — transfer always inherits). */
  onSelect: (asset: Asset | null) => void;
  position: Position | null;
  currentAsset: Asset | null;
  /* signingMode = true changes the modal into the quarterly-transfer
     "sign new player" experience: shows an Inherit/Split radio at the
     top and disables the Release button (releases happen via Sub off
     instead). */
  signingMode?: boolean;
  /* Used in signingMode to show the % the outgoing player held and to
     describe what Split will do. */
  outgoingAllocation?: number;
  currentAllocations?: { symbol: string; allocation: number }[];
}

export const AssetSelector: React.FC<AssetSelectorProps> = ({
  isOpen,
  onClose,
  onSelect,
  position,
  currentAsset,
  signingMode = false,
  outgoingAllocation,
}) => {
  const [selectedSector, setSelectedSector] = useState<string>('All');
  const [selectedType, setSelectedType] = useState<string>('All');
  const [showSuggestedOnly, setShowSuggestedOnly] = useState(false);
  const { results: searchResults, isLoading, error, searchTerm, setSearchTerm } = useAssetSearch('');

  const positionRiskLevel = position ? POSITION_RISK_MAP[position.row] : null;

  const filteredAssets = useMemo(() => {
    let assets = searchTerm.trim() ? searchResults : MOCK_ASSETS;

    if (selectedSector !== 'All') assets = assets.filter((a) => a.sector === selectedSector);
    if (selectedType !== 'All') assets = assets.filter((a) => a.type === selectedType);

    if (showSuggestedOnly && positionRiskLevel) {
      assets = assets.filter((a) => getAssetRiskLevel(a.beta) === positionRiskLevel);
    }

    if (positionRiskLevel) {
      assets = [...assets].sort((a, b) => {
        const aMatches = getAssetRiskLevel(a.beta) === positionRiskLevel;
        const bMatches = getAssetRiskLevel(b.beta) === positionRiskLevel;
        if (aMatches && !bMatches) return -1;
        if (!aMatches && bMatches) return 1;
        return b.dayChangePercent - a.dayChangePercent;
      });
    }

    return assets;
  }, [searchTerm, searchResults, selectedSector, selectedType, showSuggestedOnly, positionRiskLevel]);

  const handleSelect = (asset: Asset) => {
    const isExternal = !MOCK_ASSETS.some((a) => a.id === asset.id);
    if (isExternal) addExternalAsset(asset);

    onSelect(asset);
    onClose();
    setSearchTerm('');
    setSelectedSector('All');
    setSelectedType('All');
  };

  const handleRemove = () => {
    onSelect(null);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Sign player to ${position?.name || 'position'}`}
      subtitle={`TRANSFER MARKET · ${position?.shortName?.toUpperCase() || ''}`}
      size="lg"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Transfer-in note — in signingMode the new player simply takes
            the outgoing player's slot and weight. Allocation re-balancing
            happens on Sub Off (weekend), not here. */}
        {signingMode && outgoingAllocation !== undefined && (
          <div
            className="stadium-card"
            style={{
              padding: '10px 14px',
              background: 'var(--pitch-tint)',
              borderColor: 'oklch(0.72 0.21 145 / 0.3)',
            }}
          >
            <div className="kicker" style={{ color: 'var(--pitch)' }}>SIGNING</div>
            <p className="mono" style={{ fontSize: 11, color: 'var(--text-dim)', margin: '4px 0 0', lineHeight: 1.5 }}>
              The new player takes the outgoing player&apos;s slot at {outgoingAllocation.toFixed(1)}%. To rebalance weights, use Sub off after the weekend opens.
            </p>
          </div>
        )}

        {/* Current selection */}
        {currentAsset && (
          <div
            className="stadium-card flex items-center justify-between"
            style={{
              padding: '12px 14px',
              background: 'var(--pitch-tint)',
              borderColor: 'oklch(0.72 0.21 145 / 0.3)',
            }}
          >
            <div className="flex items-center" style={{ gap: 12 }}>
              <div
                className="display num"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 4,
                  background: 'var(--surface)',
                  border: '1px solid var(--line)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  color: 'var(--pitch)',
                  flexShrink: 0,
                }}
              >
                {currentAsset.symbol.slice(0, 4)}
              </div>
              <div style={{ minWidth: 0 }}>
                <div className="display num" style={{ fontSize: 14, letterSpacing: '-0.02em' }}>
                  {currentAsset.symbol}
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: 10,
                    color: 'var(--text-mute)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  CURRENTLY SIGNED · {currentAsset.name}
                </div>
              </div>
            </div>
            {!signingMode && (
              <button
                type="button"
                onClick={handleRemove}
                className="stadium-btn"
                style={{
                  padding: '6px 12px',
                  fontSize: 11,
                  background: 'var(--ref-red)',
                  color: '#fff',
                  border: '1px solid var(--ref-red)',
                }}
              >
                Release
              </button>
            )}
          </div>
        )}

        {/* Position risk recommendation */}
        {positionRiskLevel && (
          <div
            className="stadium-card flex items-center justify-between"
            style={{
              padding: '10px 14px',
              background: 'var(--surface-2)',
            }}
          >
            <div className="flex items-center" style={{ gap: 10 }}>
              <span
                className={RISK_CONFIG[positionRiskLevel].pillClass}
                style={{ padding: '3px 8px' }}
              >
                {RISK_CONFIG[positionRiskLevel].code}
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                {RISK_CONFIG[positionRiskLevel].label}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowSuggestedOnly(!showSuggestedOnly)}
              className="mono"
              style={{
                padding: '5px 10px',
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                background: showSuggestedOnly ? 'var(--pitch)' : 'transparent',
                color: showSuggestedOnly ? 'oklch(0.14 0.05 145)' : 'var(--text-dim)',
                border: '1px solid ' + (showSuggestedOnly ? 'var(--pitch-deep)' : 'var(--line)'),
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              {showSuggestedOnly ? 'Showing suggested' : 'Show all'}
            </button>
          </div>
        )}

        {/* Filters */}
        <div
          className="flex flex-wrap"
          style={{ gap: 8, alignItems: 'center' }}
        >
          <div style={{ flex: 1, minWidth: 220 }}>
            <Input
              placeholder="Scout a ticker (e.g. NVDA, COIN)…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              leftIcon={
                isLoading ? (
                  <span
                    style={{
                      display: 'inline-block',
                      width: 12,
                      height: 12,
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
          <StadiumSelect
            value={selectedSector}
            onChange={setSelectedSector}
            options={[
              { value: 'All', label: 'All sectors' },
              ...SECTORS.map((s) => ({ value: s, label: s })),
            ]}
          />
          <StadiumSelect
            value={selectedType}
            onChange={setSelectedType}
            options={[
              { value: 'All', label: 'All types' },
              { value: 'stock', label: 'Stocks' },
              { value: 'etf', label: 'ETFs' },
              { value: 'bond', label: 'Bonds' },
              { value: 'reit', label: 'REITs' },
              { value: 'commodity', label: 'Commodities' },
            ]}
          />
        </div>

        {/* Error */}
        {error && (
          <div
            className="stadium-card"
            style={{
              padding: '10px 12px',
              background: 'oklch(0.65 0.22 25 / 0.08)',
              borderColor: 'oklch(0.65 0.22 25 / 0.3)',
            }}
          >
            <p
              className="mono"
              style={{ margin: 0, fontSize: 11, color: 'var(--ref-red)', letterSpacing: '0.02em' }}
            >
              {error}
            </p>
          </div>
        )}

        {/* Search hint */}
        {searchTerm.trim() && filteredAssets.length === 0 && !isLoading && !error && (
          <div
            className="stadium-card"
            style={{ padding: '10px 12px', borderStyle: 'dashed' }}
          >
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-dim)' }}>
              No local matches. Try a valid stock ticker (PLTR, TSLA) to search Yahoo Finance.
            </p>
          </div>
        )}

        {/* Asset list */}
        <div
          style={{
            maxHeight: 420,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            paddingRight: 4,
          }}
        >
          {isLoading && searchTerm.trim() && (
            <div style={{ padding: 32, textAlign: 'center' }}>
              <div className="stadium-spinner" style={{ width: 28, height: 28, margin: '0 auto 10px' }} />
              <div className="kicker">SEARCHING FOR “{searchTerm}”…</div>
            </div>
          )}

          <AnimatePresence mode="popLayout">
            {!isLoading &&
              filteredAssets.map((asset) => {
                const assetRiskLevel = getAssetRiskLevel(asset.beta);
                const isMatchingRisk = positionRiskLevel && assetRiskLevel === positionRiskLevel;
                const riskCfg = RISK_CONFIG[assetRiskLevel];
                const isExternal = !MOCK_ASSETS.some((a) => a.id === asset.id);
                const isSelected = currentAsset?.id === asset.id;
                const up = asset.dayChangePercent >= 0;

                return (
                  <motion.button
                    key={asset.id}
                    layout
                    type="button"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    onClick={() => handleSelect(asset)}
                    style={{
                      width: '100%',
                      display: 'grid',
                      gridTemplateColumns: '40px minmax(0, 1fr) auto auto',
                      gap: 12,
                      padding: '10px 12px',
                      background: isSelected
                        ? 'var(--pitch-tint)'
                        : isMatchingRisk
                        ? 'var(--surface-2)'
                        : 'var(--surface)',
                      border: '1px solid ' + (isSelected ? 'var(--pitch)' : 'var(--line)'),
                      borderRadius: 8,
                      cursor: 'pointer',
                      alignItems: 'center',
                      transition: 'background .12s, border-color .12s, transform .12s',
                      color: 'inherit',
                      textAlign: 'left',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.borderColor = 'var(--pitch)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.borderColor = 'var(--line)';
                    }}
                  >
                    {/* Symbol tile */}
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 4,
                        background: 'var(--surface-2)',
                        border: '1px solid var(--line)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontFamily: 'var(--font-display)',
                        fontWeight: 700,
                        fontSize: 11,
                        color: 'var(--pitch)',
                        letterSpacing: '-0.02em',
                        position: 'relative',
                      }}
                    >
                      {asset.symbol.slice(0, 4)}
                      <span
                        style={{
                          position: 'absolute',
                          top: -3,
                          right: -3,
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: riskCfg.color,
                          border: '1px solid var(--surface)',
                        }}
                        title={riskCfg.label}
                      />
                    </div>

                    {/* Info */}
                    <div style={{ minWidth: 0 }}>
                      <div className="flex items-center flex-wrap" style={{ gap: 5 }}>
                        <span
                          className="display num"
                          style={{ fontSize: 13, letterSpacing: '-0.02em' }}
                        >
                          {asset.symbol}
                        </span>
                        <span className={riskCfg.pillClass} style={{ padding: '1px 5px', fontSize: 9 }}>
                          {riskCfg.code}
                        </span>
                        <span className="pill" style={{ padding: '1px 5px', fontSize: 9 }}>
                          {asset.type.toUpperCase()}
                        </span>
                        {isMatchingRisk && (
                          <span className="pill pill-pitch" style={{ padding: '1px 5px', fontSize: 9 }}>
                            SUGGESTED
                          </span>
                        )}
                        {isExternal && (
                          <span className="pill pill-sky" style={{ padding: '1px 5px', fontSize: 9 }}>
                            YAHOO
                          </span>
                        )}
                      </div>
                      <div
                        className="mono"
                        style={{
                          fontSize: 10,
                          color: 'var(--text-mute)',
                          marginTop: 2,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          letterSpacing: '0.04em',
                        }}
                      >
                        {asset.name.toUpperCase()} · {asset.sector.toUpperCase()}
                      </div>
                    </div>

                    {/* Price + change */}
                    <div style={{ textAlign: 'right' }}>
                      <div className="mono num" style={{ fontSize: 12, color: 'var(--text)' }}>
                        {formatCurrency(asset.currentPrice)}
                      </div>
                      <div
                        className="mono num"
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: up ? 'var(--pitch)' : 'var(--ref-red)',
                        }}
                      >
                        {formatPercent(asset.dayChangePercent)}
                      </div>
                    </div>

                    {/* Stats column (hidden on small) */}
                    <div
                      className="hidden sm:flex"
                      style={{
                        flexDirection: 'column',
                        gap: 2,
                        textAlign: 'right',
                        minWidth: 90,
                      }}
                    >
                      <div className="flex justify-between" style={{ gap: 8 }}>
                        <span className="kicker" style={{ fontSize: 8 }}>P/E</span>
                        <span className="mono num" style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                          {asset.peRatio !== null ? asset.peRatio.toFixed(1) : 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between" style={{ gap: 8 }}>
                        <span className="kicker" style={{ fontSize: 8 }}>BETA</span>
                        <span
                          className="mono num"
                          style={{ fontSize: 10, color: riskCfg.color, fontWeight: 700 }}
                        >
                          {asset.beta.toFixed(2)}
                        </span>
                      </div>
                      {asset.dividendYield > 0 && (
                        <div className="flex justify-between" style={{ gap: 8 }}>
                          <span className="kicker" style={{ fontSize: 8 }}>DIV</span>
                          <span className="mono num" style={{ fontSize: 10, color: 'var(--pitch)' }}>
                            {asset.dividendYield.toFixed(2)}%
                          </span>
                        </div>
                      )}
                    </div>
                  </motion.button>
                );
              })}
          </AnimatePresence>

          {!isLoading && filteredAssets.length === 0 && !searchTerm.trim() && (
            <div style={{ padding: 32, textAlign: 'center' }}>
              <Icon.Scout size={28} style={{ color: 'var(--text-mute)', margin: '0 auto 8px' }} />
              <div className="kicker">NO TICKERS MATCH THIS FILTER</div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

const StadiumSelect: React.FC<{
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}> = ({ value, onChange, options }) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    style={{
      padding: '10px 30px 10px 14px',
      background: 'var(--surface-2)',
      border: '1px solid var(--line)',
      borderRadius: 8,
      color: 'var(--text)',
      fontFamily: 'var(--font-body)',
      fontSize: 12,
      cursor: 'pointer',
      outline: 'none',
      appearance: 'none',
      backgroundImage:
        "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23808890' stroke-width='2'><path d='M6 9 L12 15 L18 9'/></svg>\")",
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'right 10px center',
    }}
    onFocus={(e) => {
      e.currentTarget.style.borderColor = 'var(--pitch)';
      e.currentTarget.style.background = 'var(--surface)';
    }}
    onBlur={(e) => {
      e.currentTarget.style.borderColor = 'var(--line)';
      e.currentTarget.style.background = 'var(--surface-2)';
    }}
  >
    {options.map((opt) => (
      <option key={opt.value} value={opt.value}>
        {opt.label}
      </option>
    ))}
  </select>
);

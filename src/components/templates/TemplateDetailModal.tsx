'use client';

import React from 'react';
import { PortfolioTemplate, FORMATIONS, RiskLevel } from '@/types';
import { Modal } from '@/components/ui';
import { Icon } from '@/components/stadium/Icon';

interface TemplateDetailModalProps {
  template: PortfolioTemplate | null;
  isOpen: boolean;
  onClose: () => void;
  onUseTemplate: (templateId: string) => void;
  isCreating: boolean;
}

const riskPillClass = (r: RiskLevel) =>
  r === 'low' ? 'pill pill-sky' : r === 'medium' ? 'pill pill-whistle' : 'pill pill-red';
const riskCode = (r: RiskLevel) => (r === 'low' ? 'DEF' : r === 'medium' ? 'MID' : 'ATK');

const DIFFICULTY_PILL: Record<'beginner' | 'intermediate' | 'advanced', string> = {
  beginner: 'pill pill-sky',
  intermediate: 'pill pill-whistle',
  advanced: 'pill pill-red',
};

const ROW_LABELS: Record<number, { title: string; code: string; pill: string }> = {
  0: { title: 'GOAL · ULTRA-DEFENSIVE',    code: 'GK',  pill: 'pill pill-sky' },
  1: { title: 'DEFENSE · LOW VOLATILITY',  code: 'DEF', pill: 'pill pill-sky' },
  2: { title: 'MIDFIELD · BALANCED',       code: 'MID', pill: 'pill pill-whistle' },
  3: { title: 'ATTACK · HIGH GROWTH',      code: 'ATK', pill: 'pill pill-red' },
};

export const TemplateDetailModal: React.FC<TemplateDetailModalProps> = ({
  template,
  isOpen,
  onClose,
  onUseTemplate,
  isCreating,
}) => {
  if (!template) return null;

  const positions = FORMATIONS[template.formation];

  const getPositionShortName = (positionId: string) => {
    const position = positions.find((p) => p.id === positionId);
    return position?.shortName || positionId.toUpperCase();
  };

  const getPositionRow = (positionId: string) => {
    const position = positions.find((p) => p.id === positionId);
    return position?.row ?? 0;
  };

  const groupedStocks = template.stocks.reduce(
    (acc, stock) => {
      const row = getPositionRow(stock.positionId);
      if (!acc[row]) acc[row] = [];
      acc[row].push(stock);
      return acc;
    },
    {} as Record<number, typeof template.stocks>,
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={template.name}
      subtitle={`LINEUP · ${template.formation}`}
      size="lg"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* Description + badges */}
        <div>
          <p
            style={{
              color: 'var(--text-dim)',
              fontSize: 13,
              lineHeight: 1.6,
              margin: 0,
              marginBottom: 12,
            }}
          >
            {template.description}
          </p>
          <div className="flex flex-wrap" style={{ gap: 6 }}>
            <span className={riskPillClass(template.expectedRisk)} style={{ padding: '3px 8px' }}>
              {riskCode(template.expectedRisk)} · {template.expectedRisk}
            </span>
            <span className={DIFFICULTY_PILL[template.difficulty]} style={{ padding: '3px 8px' }}>
              {template.difficulty}
            </span>
            <span className="pill pill-pitch" style={{ padding: '3px 8px' }}>
              {template.category}
            </span>
          </div>
        </div>

        {/* Lineup by row */}
        <section>
          <div className="flex items-baseline justify-between" style={{ marginBottom: 12 }}>
            <div>
              <div className="kicker">STARTING XI · BY POSITION</div>
              <div className="display" style={{ fontSize: 16, letterSpacing: '-0.02em', marginTop: 2 }}>
                Lineup
              </div>
            </div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--text-mute)' }}>
              {template.stocks.length} TICKERS
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[3, 2, 1, 0].map(
              (row) =>
                groupedStocks[row] && (
                  <div
                    key={row}
                    className="stadium-card"
                    style={{ padding: 12 }}
                  >
                    <div className="flex items-center" style={{ gap: 8, marginBottom: 8 }}>
                      <span className={ROW_LABELS[row].pill} style={{ padding: '2px 6px' }}>
                        {ROW_LABELS[row].code}
                      </span>
                      <span className="kicker">{ROW_LABELS[row].title}</span>
                    </div>
                    <div className="flex flex-wrap" style={{ gap: 6 }}>
                      {groupedStocks[row].map((stock) => (
                        <div
                          key={stock.positionId}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '6px 10px',
                            background: 'var(--surface-2)',
                            border: '1px solid var(--line)',
                            borderRadius: 6,
                          }}
                        >
                          <span
                            className="mono"
                            style={{
                              fontSize: 9,
                              fontWeight: 700,
                              color: 'var(--text-mute)',
                              letterSpacing: '0.08em',
                              padding: '1px 5px',
                              background: 'var(--surface)',
                              border: '1px solid var(--line)',
                              borderRadius: 3,
                            }}
                          >
                            {getPositionShortName(stock.positionId)}
                          </span>
                          <span
                            className="display num"
                            style={{ fontSize: 13, letterSpacing: '-0.02em' }}
                          >
                            {stock.symbol}
                          </span>
                          <span
                            className="mono num"
                            style={{ fontSize: 10, color: 'var(--text-mute)' }}
                          >
                            {stock.allocation.toFixed(1)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ),
            )}
          </div>
        </section>

        {/* Tags */}
        {template.tags.length > 0 && (
          <div>
            <div className="kicker" style={{ marginBottom: 8 }}>TAGS</div>
            <div className="flex flex-wrap" style={{ gap: 4 }}>
              {template.tags.map((tag) => (
                <span
                  key={tag}
                  className="mono"
                  style={{
                    padding: '2px 8px',
                    fontSize: 10,
                    color: 'var(--pitch)',
                    background: 'var(--pitch-tint)',
                    border: '1px solid oklch(0.72 0.21 145 / 0.3)',
                    borderRadius: 3,
                    letterSpacing: '0.04em',
                  }}
                >
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex" style={{ gap: 10, paddingTop: 6 }}>
          <button
            type="button"
            onClick={onClose}
            className="stadium-btn stadium-btn-ghost"
            style={{ flex: 1, justifyContent: 'center', padding: '11px 14px' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onUseTemplate(template.id)}
            disabled={isCreating}
            className="stadium-btn stadium-btn-primary"
            style={{ flex: 1.4, justifyContent: 'center', padding: '11px 14px' }}
          >
            {isCreating ? (
              <>
                <span
                  style={{
                    width: 12,
                    height: 12,
                    border: '2px solid currentColor',
                    borderTopColor: 'transparent',
                    borderRadius: '50%',
                    animation: 'stadium-spin 0.9s linear infinite',
                  }}
                />
                Fielding…
              </>
            ) : (
              <>
                <Icon.Lineup size={14} /> Use this lineup
              </>
            )}
          </button>
        </div>
        <p
          className="mono"
          style={{
            textAlign: 'center',
            fontSize: 10,
            color: 'var(--text-mute)',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            margin: 0,
          }}
        >
          Creates a new squad pre-filled with these tickers
        </p>
      </div>
    </Modal>
  );
};

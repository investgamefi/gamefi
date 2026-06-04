'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { AppLayout } from '@/components';
import { useStore } from '@/store/useStore';
import { PORTFOLIO_TEMPLATES, TemplateCategory, RiskLevel, PortfolioTemplate, Asset } from '@/types';
import { TemplateDetailModal } from '@/components/templates';
import { TeamLimitModal } from '@/components/ui';
import { Icon } from '@/components/stadium/Icon';

const CATEGORIES: { value: TemplateCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'growth', label: 'Growth' },
  { value: 'dividend', label: 'Dividend' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'sector', label: 'Sector' },
  { value: 'trending', label: 'Trending' },
];

/* Map the existing risk/difficulty taxonomies to the stadium DEF/MID/ATK pill colours. */
const riskPillClass = (r: RiskLevel) =>
  r === 'low' ? 'pill pill-sky' : r === 'medium' ? 'pill pill-whistle' : 'pill pill-red';
const riskCode = (r: RiskLevel) => (r === 'low' ? 'DEF' : r === 'medium' ? 'MID' : 'ATK');

const DIFFICULTY_PILL: Record<'beginner' | 'intermediate' | 'advanced', string> = {
  beginner: 'pill pill-sky',
  intermediate: 'pill pill-whistle',
  advanced: 'pill pill-red',
};

export default function TemplatesPage() {
  const router = useRouter();
  const {
    currentUser,
    createPortfolio,
    assignAssetToPosition,
    canCreateTeam,
    getTeamSlotInfo,
    unlockTeamSlot,
  } = useStore();
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory | 'all'>('all');
  const [creatingFromTemplate, setCreatingFromTemplate] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<PortfolioTemplate | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [pendingTemplateId, setPendingTemplateId] = useState<string | null>(null);

  const teamSlotInfo = getTeamSlotInfo();

  const filteredTemplates = PORTFOLIO_TEMPLATES.filter(
    (t) => selectedCategory === 'all' || t.category === selectedCategory,
  );

  const handleViewTemplate = (template: PortfolioTemplate) => {
    setSelectedTemplate(template);
    setShowDetailModal(true);
  };

  const handleCloseModal = () => {
    setShowDetailModal(false);
    setSelectedTemplate(null);
  };

  const fetchAssetData = async (symbol: string): Promise<Asset | null> => {
    try {
      const response = await fetch(`/api/yahoo-finance?symbol=${encodeURIComponent(symbol)}`);
      const data = await response.json();
      if (data.success && data.asset) return data.asset;
      return null;
    } catch (error) {
      console.error(`Failed to fetch data for ${symbol}:`, error);
      return null;
    }
  };

  const handleUseTemplate = async (templateId: string) => {
    if (!currentUser) {
      router.push('/');
      return;
    }
    if (!canCreateTeam()) {
      setPendingTemplateId(templateId);
      setShowLimitModal(true);
      return;
    }
    await createFromTemplate(templateId);
  };

  const createFromTemplate = async (templateId: string) => {
    const template = PORTFOLIO_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;

    setCreatingFromTemplate(templateId);
    try {
      const portfolio = await createPortfolio(
        `${template.name} (Copy)`,
        template.description,
        template.formation,
      );

      if (portfolio) {
        for (const stock of template.stocks) {
          const asset = await fetchAssetData(stock.symbol);
          if (asset) {
            await assignAssetToPosition(portfolio.id, stock.positionId, asset);
          }
        }
        handleCloseModal();
        setShowLimitModal(false);
        router.push(`/portfolio/${portfolio.id}`);
      }
    } catch (error) {
      console.error('Failed to create portfolio from template:', error);
    } finally {
      setCreatingFromTemplate(null);
      setPendingTemplateId(null);
    }
  };

  const handleUnlockSlot = async () => {
    const success = await unlockTeamSlot();
    if (success && pendingTemplateId) {
      setShowLimitModal(false);
      await createFromTemplate(pendingTemplateId);
    }
  };

  return (
    <AppLayout flush>
      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* Header */}
        <div>
          <div className="kicker">LINEUPS · {PORTFOLIO_TEMPLATES.length} PRE-BUILT</div>
          <h1
            className="display"
            style={{ fontSize: 'clamp(24px, 3vw, 32px)', letterSpacing: '-0.04em', margin: '2px 0 0' }}
          >
            Lineups
          </h1>
          <div className="mono" style={{ fontSize: 12, color: 'var(--text-mute)', marginTop: 6 }}>
            Borrow a pre-built squad. Clone any lineup straight into a new squad — customise it from there.
          </div>
        </div>

        {/* Category chips */}
        <div className="flex flex-wrap" style={{ gap: 6 }}>
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              type="button"
              onClick={() => setSelectedCategory(cat.value)}
              className="mono"
              style={{
                padding: '6px 12px',
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                background: selectedCategory === cat.value ? 'var(--pitch)' : 'var(--surface)',
                color: selectedCategory === cat.value ? 'oklch(0.14 0.05 145)' : 'var(--text-dim)',
                border: '1px solid ' + (selectedCategory === cat.value ? 'var(--pitch-deep)' : 'var(--line)'),
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Templates grid */}
        {filteredTemplates.length === 0 ? (
          <div
            className="stadium-card"
            style={{ padding: 48, textAlign: 'center', borderStyle: 'dashed' }}
          >
            <Icon.Lineup size={36} style={{ color: 'var(--text-mute)', margin: '0 auto 12px' }} />
            <div className="display" style={{ fontSize: 16 }}>
              No lineups in this category yet
            </div>
            <div className="mono" style={{ fontSize: 11, color: 'var(--text-mute)', marginTop: 4 }}>
              Try a different category or check back later.
            </div>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: 14,
            }}
          >
            {filteredTemplates.map((template, index) => (
              <motion.div
                key={template.id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.04, 0.5) }}
                className="stadium-card"
                style={{
                  overflow: 'hidden',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'border-color .15s ease',
                }}
                onClick={() => handleViewTemplate(template)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--pitch)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--line)';
                }}
              >
                {/* Header */}
                <div
                  style={{
                    padding: 16,
                    borderBottom: '1px solid var(--line)',
                  }}
                >
                  <div className="flex items-start justify-between" style={{ gap: 8, marginBottom: 6 }}>
                    <div
                      className="display"
                      style={{
                        fontSize: 17,
                        letterSpacing: '-0.02em',
                        lineHeight: 1.2,
                      }}
                    >
                      {template.name}
                    </div>
                    <span className="pill pill-pitch" style={{ flexShrink: 0 }}>{template.formation}</span>
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: 'var(--text-dim)',
                      lineHeight: 1.55,
                      marginBottom: 10,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {template.description}
                  </div>
                  <div className="flex flex-wrap" style={{ gap: 6 }}>
                    <span className={riskPillClass(template.expectedRisk)} style={{ padding: '2px 6px' }}>
                      {riskCode(template.expectedRisk)} · {template.expectedRisk}
                    </span>
                    <span className={DIFFICULTY_PILL[template.difficulty]} style={{ padding: '2px 6px' }}>
                      {template.difficulty}
                    </span>
                  </div>
                </div>

                {/* Stocks preview */}
                <div
                  style={{
                    padding: '12px 16px',
                    background: 'var(--surface-2)',
                  }}
                >
                  <div className="kicker" style={{ marginBottom: 6 }}>STARTING XI</div>
                  <div className="flex flex-wrap" style={{ gap: 4 }}>
                    {template.stocks.slice(0, 7).map((stock) => (
                      <span
                        key={stock.positionId}
                        className="mono num"
                        style={{
                          padding: '2px 6px',
                          fontSize: 10,
                          background: 'var(--surface)',
                          border: '1px solid var(--line)',
                          color: 'var(--text)',
                          borderRadius: 3,
                          fontWeight: 600,
                          letterSpacing: '-0.01em',
                        }}
                      >
                        {stock.symbol}
                      </span>
                    ))}
                    {template.stocks.length > 7 && (
                      <span
                        className="mono"
                        style={{
                          padding: '2px 6px',
                          fontSize: 10,
                          background: 'transparent',
                          color: 'var(--text-mute)',
                          borderRadius: 3,
                        }}
                      >
                        +{template.stocks.length - 7}
                      </span>
                    )}
                  </div>
                </div>

                {/* Tags */}
                {template.tags.length > 0 && (
                  <div
                    style={{
                      padding: '10px 16px',
                      borderTop: '1px solid var(--line)',
                    }}
                  >
                    <div className="flex flex-wrap" style={{ gap: 4 }}>
                      {template.tags.slice(0, 4).map((tag) => (
                        <span
                          key={tag}
                          className="mono"
                          style={{
                            padding: '2px 6px',
                            fontSize: 9,
                            color: 'var(--pitch)',
                            background: 'var(--pitch-tint)',
                            borderRadius: 3,
                            letterSpacing: '0.05em',
                          }}
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div
                  style={{
                    padding: 12,
                    borderTop: '1px solid var(--line)',
                    display: 'flex',
                    gap: 8,
                    marginTop: 'auto',
                  }}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleViewTemplate(template);
                    }}
                    className="stadium-btn stadium-btn-ghost"
                    style={{
                      flex: 1,
                      justifyContent: 'center',
                      padding: '8px 10px',
                      fontSize: 11,
                    }}
                  >
                    Details
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUseTemplate(template.id);
                    }}
                    disabled={creatingFromTemplate === template.id}
                    className="stadium-btn stadium-btn-primary"
                    style={{
                      flex: 1.3,
                      justifyContent: 'center',
                      padding: '8px 10px',
                      fontSize: 11,
                      opacity: creatingFromTemplate === template.id ? 0.6 : 1,
                    }}
                  >
                    {creatingFromTemplate === template.id ? (
                      <>
                        <span
                          style={{
                            width: 10,
                            height: 10,
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
                        <Icon.Lineup size={12} /> Use lineup
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Template Detail Modal */}
      <TemplateDetailModal
        template={selectedTemplate}
        isOpen={showDetailModal}
        onClose={handleCloseModal}
        onUseTemplate={handleUseTemplate}
        isCreating={creatingFromTemplate === selectedTemplate?.id}
      />

      {/* Team Limit Modal */}
      <TeamLimitModal
        isOpen={showLimitModal}
        onClose={() => {
          setShowLimitModal(false);
          setPendingTemplateId(null);
        }}
        currentTeams={teamSlotInfo.current}
        maxTeams={teamSlotInfo.max}
        userXp={currentUser?.xp || 0}
        onUnlockSlot={handleUnlockSlot}
      />
    </AppLayout>
  );
}

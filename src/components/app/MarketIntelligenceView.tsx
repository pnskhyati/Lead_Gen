import React from 'react';
import type { NavCategory, SubCategory } from '../../types';
import TecavyPageHead from './TecavyPageHead';

interface MarketIntelligenceViewProps {
  onNavigate: (category: NavCategory, sub?: SubCategory) => void;
}

export default function MarketIntelligenceView({ onNavigate }: MarketIntelligenceViewProps) {
  return (
    <div>
      <TecavyPageHead
        label="Intelligence / Future module"
        title="Market Intelligence"
        description="Evidence-led opportunities — use live competitor analysis and analytics today; full intelligence module is a roadmap concept."
        tools={<span className="tx-tag amber">Concept · competitor agent live</span>}
      />

      <div className="tx-insight tx-panel" style={{ marginBottom: 18, border: 'none', boxShadow: 'none' }}>
        <div
          className="flex items-center justify-center shrink-0 rounded-[10px] text-lg"
          style={{ width: 34, height: 34, background: '#d9efea', color: 'var(--tx-teal)' }}
        >
          ◈
        </div>
        <div>
          <h3 className="font-bold text-[15px] m-0 mb-1" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Observe → Explain → Recommend → Approve → Measure
          </h3>
          <p className="text-[11px] m-0" style={{ color: '#597083' }}>
            Run competitor social analysis in Agents, then turn insights into content. Analytics shows live lead and
            channel outcomes from your CRM.
          </p>
        </div>
      </div>

      <div className="tx-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 15 }}>
        {[
          {
            type: 'Competitor watch',
            title: 'Analyze competitor social',
            desc: 'Live Vertex-backed competitor intel and content packs.',
            action: 'Open competitor agent →',
            cat: 'agents' as NavCategory,
            sub: 'competitor' as SubCategory,
          },
          {
            type: 'Content advisor',
            title: 'Rewrite with competitor context',
            desc: 'Use analysis output in Content Studio drafts.',
            action: 'Content Studio →',
            cat: 'content' as NavCategory,
            sub: 'create' as SubCategory,
          },
          {
            type: 'Outcomes',
            title: 'Lead & channel performance',
            desc: 'Live leads, qualification counts, and audit export.',
            action: 'Open analytics →',
            cat: 'analytics' as NavCategory,
            sub: 'overview' as SubCategory,
          },
        ].map((card) => (
          <div key={card.title} className="tx-panel tx-panelpad">
            <div className="tx-eyebrow">{card.type}</div>
            <h3 className="font-bold text-[15px] my-3" style={{ fontFamily: 'Manrope, sans-serif' }}>
              {card.title}
            </h3>
            <p className="text-[11px] text-[var(--tx-muted)] mb-3">{card.desc}</p>
            <button
              type="button"
              className="tecavy-btn sm primary"
              onClick={() => onNavigate(card.cat, card.sub)}
            >
              {card.action}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

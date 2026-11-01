import React from 'react';
import type { NavCategory, SubCategory } from '../../types';
import TecavyPageHead from './TecavyPageHead';
import AdminView from './AdminView';
import ChannelsView from './ChannelsView';

export type SettingsSection = 'business' | 'knowledge' | 'channels' | 'automation' | 'team' | 'notifications';

const SECTIONS: { id: SettingsSection; label: string; sub: SubCategory }[] = [
  { id: 'business', label: 'Business', sub: 'business' },
  { id: 'knowledge', label: 'AI Knowledge', sub: 'ai-knowledge' },
  { id: 'channels', label: 'Connections', sub: 'connections' },
  { id: 'automation', label: 'Automation', sub: 'automation' },
  { id: 'team', label: 'Team', sub: 'team' },
  { id: 'notifications', label: 'Notifications', sub: 'notifications' },
];

function mapSubToSection(sub: SubCategory): SettingsSection {
  if (sub === 'audit') return 'knowledge';
  if (sub === 'ai-knowledge' || sub === 'brand') return 'knowledge';
  if (sub === 'connections' || sub === 'connect') return 'channels';
  if (sub === 'automation' || sub === 'ai-automation' || sub === 'lead-automation') return 'automation';
  if (sub === 'team' || sub === 'team-access') return 'team';
  if (sub === 'notifications') return 'notifications';
  return 'business';
}

interface LiveSettingsProps {
  activeSubCategory: SubCategory;
  isAdmin?: boolean;
  onNavigateSub: (sub: SubCategory) => void;
  onNavigate: (category: NavCategory, sub?: SubCategory) => void;
}

export default function LiveSettings({
  activeSubCategory,
  isAdmin = false,
  onNavigateSub,
  onNavigate,
}: LiveSettingsProps) {
  const section = mapSubToSection(activeSubCategory);
  const sectionMeta = SECTIONS.find((s) => s.id === section) || SECTIONS[0];

  return (
    <div className="tx-settings-page">
      <TecavyPageHead
        label="Workspace / Settings"
        title="Settings"
        description="Configure your business, connected channels, and agent boundaries — backed by live company APIs."
      />

      <div className="tx-settingslayout">
        <div className="tx-panel tx-settingsnav">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              className={section === s.id ? 'active' : ''}
              onClick={() => onNavigateSub(s.sub)}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="tx-panel tx-panelpad min-w-0">
          <div className="tx-sectionhead">
            <div>
              <h2>{sectionMeta.label}</h2>
              <p>
                {section === 'channels'
                  ? 'All app connections — social, messaging, Google, SEO/GEO, and AI.'
                  : section === 'team' || section === 'notifications'
                    ? 'Workspace controls — use Admin audit and profile for live team data where available.'
                    : 'Live profile, documents, voice, and automation from the Nexora backend.'}
              </p>
            </div>
          </div>

          {section === 'channels' ? (
            <ChannelsView onNavigate={onNavigate} />
          ) : section === 'team' ? (
            <div className="space-y-3 text-sm text-[var(--tx-muted)]">
              <p>Team invites and roles are managed through your workspace admin. Open audit log for agent activity.</p>
              <button
                type="button"
                className="tecavy-btn sm primary"
                onClick={() => onNavigate('settings', 'audit')}
              >
                Open audit log →
              </button>
            </div>
          ) : section === 'notifications' ? (
            <div className="space-y-3 text-sm text-[var(--tx-muted)]">
              <p>In-app toasts and inbox alerts reflect live handoffs and lead updates today.</p>
              <button type="button" className="tecavy-btn sm" onClick={() => onNavigate('inbox', 'waiting-human')}>
                View handoff queue →
              </button>
            </div>
          ) : (
            <AdminView isAdmin={isAdmin} />
          )}
        </div>
      </div>
    </div>
  );
}

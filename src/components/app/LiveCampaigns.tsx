import React, { useEffect, useState } from 'react';
import CampaignsView from './CampaignsView';
import type { Campaign, NavCategory, SubCategory } from '../../types';
import type { CampaignFormData } from '../../data/campaignBlueprintGenerator';
import { getCompanyProfile } from '../../legacy/services/companyService';

const CAMPAIGNS_KEY = 'nexora-campaigns';

function loadCampaigns(): Campaign[] {
  try {
    const raw = localStorage.getItem(CAMPAIGNS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Campaign[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

interface LiveCampaignsProps {
  activeSubCategory: SubCategory;
  onNavigate: (category: NavCategory, subCategory?: SubCategory) => void;
  onNotify?: (title: string, desc: string) => void;
}

export default function LiveCampaigns({ activeSubCategory, onNavigate, onNotify }: LiveCampaignsProps) {
  const [campaigns, setCampaigns] = useState<Campaign[]>(() => loadCampaigns());
  const [companyName, setCompanyName] = useState('');
  const [formPatch, setFormPatch] = useState<Partial<CampaignFormData>>();

  useEffect(() => {
    try {
      localStorage.setItem(CAMPAIGNS_KEY, JSON.stringify(campaigns.slice(0, 50)));
    } catch {
      /* ignore */
    }
  }, [campaigns]);

  useEffect(() => {
    void getCompanyProfile()
      .then((p) => {
        if (!p) return;
        setCompanyName(p.companyName || '');
        setFormPatch({
          name: p.companyName ? `${p.companyName} growth` : undefined,
          industry: p.industry || undefined,
          audienceDescription: p.audience || undefined,
          brandVoice: p.voiceTone?.slice(0, 40) || undefined,
          description: [p.tagline, p.productsFocus].filter(Boolean).join(' — ') || undefined,
          additionalInstructions: [
            p.writingStyle,
            p.extraGuidelines,
            (p.avoid || []).length ? `Avoid: ${(p.avoid || []).join(', ')}` : '',
          ]
            .filter(Boolean)
            .join('\n'),
        });
      })
      .catch(() => undefined);
  }, []);

  return (
    <CampaignsView
      campaigns={campaigns}
      activeSubCategory={activeSubCategory}
      companyName={companyName}
      initialFormPatch={formPatch}
      onAddCampaign={(camp) => {
        setCampaigns((prev) => [camp, ...prev]);
        onNotify?.('Campaign created', `"${camp.name}" saved — powered by live AI plan when available.`);
      }}
      onUpdateCampaign={(updated) => {
        setCampaigns((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      }}
      onNavigateToModule={(cat, sub) => onNavigate(cat as NavCategory, (sub as SubCategory) || undefined)}
      isFirstRun={campaigns.length === 0}
    />
  );
}

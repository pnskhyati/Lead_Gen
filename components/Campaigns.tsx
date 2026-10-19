import React, { useState } from 'react';
import Card from './common/Card';
import Spinner from './common/Spinner';
import { generateCampaignPlan } from '../services/geminiService';
import type { CampaignPlan, LinkedInDraft } from '../types';

interface CampaignsProps {
    openLinkedInHub?: (drafts?: LinkedInDraft[], brief?: string) => void;
}

const SectionCard: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
    <Card className="hover:!border-brand-violet/30 dark:hover:!border-brand-violet/60">
        <div className="flex items-center gap-3 mb-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-brand-violet/20 flex items-center justify-center text-brand-violet">
                {icon}
            </div>
            <h3 className="text-xl font-semibold text-slate-900 dark:text-white">{title}</h3>
        </div>
        {children}
    </Card>
);

const Campaigns: React.FC<CampaignsProps> = ({ openLinkedInHub }) => {
    const [brief, setBrief] = useState("Launch Talisker whisky to a younger, adventurous audience interested in outdoor activities and authentic experiences.");
    const [campaignPlan, setCampaignPlan] = useState<CampaignPlan | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!brief.trim()) return;

        setIsLoading(true);
        setError(null);
        setCampaignPlan(null);

        try {
            const plan = await generateCampaignPlan(brief);
            setCampaignPlan(plan);
        } catch (err) {
            setError(err instanceof Error ? err.message : "An unknown error occurred.");
        } finally {
            setIsLoading(false);
        }
    };

    const handlePushToLinkedIn = () => {
        if (!campaignPlan || !openLinkedInHub) return;

        const linkedInIdeas: string[] = [];
        campaignPlan.rolloutPlan.forEach(phase => {
            phase.platforms.forEach(p => {
                if (/linkedin/i.test(p.platform)) {
                    p.contentIdeas.forEach(idea => linkedInIdeas.push(idea));
                }
            });
        });

        const topicsBlock = linkedInIdeas.length
            ? `\n\nLinkedIn content ideas from rollout:\n${linkedInIdeas.map((t, i) => `${i + 1}. ${t}`).join('\n')}`
            : '';

        const hubBrief = [
            `Campaign: ${campaignPlan.campaignTitle}`,
            `Slogan: ${campaignPlan.slogan}`,
            `Original brief: ${brief}`,
            topicsBlock,
        ].filter(Boolean).join('\n');

        if (linkedInIdeas.length > 0) {
            const drafts: LinkedInDraft[] = linkedInIdeas.map((idea, i) => ({
                headline: idea.slice(0, 120),
                content: idea,
                hashtags: [],
                imagePrompt: `Professional LinkedIn infographic about: ${idea}`,
                source: 'manual' as const,
            }));
            openLinkedInHub(drafts, hubBrief);
        } else {
            openLinkedInHub(undefined, hubBrief);
        }
    };

    return (
        <div className="animate-fade-in space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-1">AI Campaign Planner</h1>
                <p className="text-slate-500 dark:text-slate-400">Transform a simple brief into a comprehensive marketing strategy.</p>
            </div>

            <Card>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="campaign-brief" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Campaign Brief</label>
                        <textarea
                            id="campaign-brief"
                            value={brief}
                            onChange={(e) => setBrief(e.target.value)}
                            rows={3}
                            placeholder="e.g., Launch a new flavor of Smirnoff for summer music festivals..."
                            className="w-full bg-soft-bg border border-transparent rounded-2xl py-2.5 px-4 text-ink focus:outline-none focus:ring-4 focus:ring-soft-sky/60 focus:bg-white transition-all"
                        />
                    </div>
                        <button type="submit" disabled={isLoading} className="nexora-btn-primary w-full py-3.5 px-4 text-sm flex items-center justify-center gap-2">
                            {isLoading ? (<><Spinner /> Building plan (20–40s)…</>) : 'Generate Campaign Plan'}
                        </button>
                </form>
            </Card>

            {isLoading && (
                <Card className="flex flex-col items-center justify-center h-96">
                    <Spinner />
                    <p className="mt-4 text-slate-700 dark:text-slate-300 font-semibold">Generating your strategic blueprint...</p>
                    <p className="text-slate-500 dark:text-slate-500 text-sm">This may take a moment.</p>
                </Card>
            )}

            {error && <div className="text-red-500 dark:text-red-400 bg-red-500/10 dark:bg-red-900/50 p-4 rounded-md">{error}</div>}

            {campaignPlan && !isLoading && (
                <div className="space-y-6 animate-fade-in">
                    <div className="text-center p-6 bg-slate-100 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700">
                        <h2 className="text-3xl font-bold text-brand-blue">{campaignPlan.campaignTitle}</h2>
                        <p className="text-xl text-slate-800 dark:text-white mt-2 font-light">"{campaignPlan.slogan}"</p>
                        {openLinkedInHub && (
                            <button
                                type="button"
                                onClick={handlePushToLinkedIn}
                                className="mt-4 inline-flex items-center gap-2 bg-blue-600 text-white font-bold py-2.5 px-5 rounded-md hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.238 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" /></svg>
                                Push LinkedIn ideas to scheduler
                            </button>
                        )}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <SectionCard title="Target Personas" icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" /></svg>}>
                            <div className="space-y-4">
                                {campaignPlan.personas.map(p => (
                                    <div key={p.name} className="p-3 bg-slate-100 dark:bg-slate-800/60 rounded-lg">
                                        <h4 className="font-semibold text-slate-800 dark:text-white">{p.name}</h4>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 italic mt-1">{p.description}</p>
                                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-2"><strong className="text-brand-violet/80">Motivations:</strong> {p.motivations.join(', ')}</p>
                                    </div>
                                ))}
                            </div>
                        </SectionCard>

                        <SectionCard title="Messaging Pillars" icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" /></svg>}>
                            <ul className="space-y-3">
                                {campaignPlan.messagingPillars.map(m => (
                                    <li key={m.pillar}>
                                        <p className="font-semibold text-slate-800 dark:text-white">{m.pillar}</p>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">{m.description}</p>
                                    </li>
                                ))}
                            </ul>
                        </SectionCard>
                    </div>

                    <SectionCard title="Rollout Plan" icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" /></svg>}>
                        <div className="space-y-6">
                            {campaignPlan.rolloutPlan.map(phase => (
                                <div key={phase.phase}>
                                    <h4 className="text-lg font-bold text-brand-blue">{phase.phase} <span className="text-sm font-medium text-slate-500 dark:text-slate-400">({phase.duration})</span></h4>
                                    <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 mb-3">{phase.objective}</p>
                                    <div className="space-y-3">
                                        {phase.platforms.map(p => (
                                            <div key={p.platform} className="p-3 bg-slate-100 dark:bg-slate-800/60 rounded-lg">
                                                <h5 className="font-semibold text-slate-800 dark:text-white">{p.platform}</h5>
                                                <ul className="list-disc list-inside text-sm text-slate-500 dark:text-slate-400 mt-1 space-y-1">
                                                    {p.contentIdeas.map((idea, i) => <li key={i}>{idea}</li>)}
                                                </ul>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </SectionCard>
                    
                    <SectionCard title="Key Performance Indicators (KPIs)" icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 11.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd" /></svg>}>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                           {campaignPlan.kpis.map(kpi => (
                               <div key={kpi} className="bg-slate-100 dark:bg-slate-800/60 text-center p-3 rounded-lg">
                                   <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{kpi}</p>
                               </div>
                           ))}
                        </div>
                    </SectionCard>

                </div>
            )}

        </div>
    );
};

export default Campaigns;
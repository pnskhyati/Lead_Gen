import React, { useState } from 'react';
import Card from './common/Card';
import Spinner from './common/Spinner';
import { generateCampaignPlan } from '../services/geminiService';
import type { CampaignPlan } from '../types';

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

const Campaigns: React.FC = () => {
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
                            className="w-full bg-white/50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-md shadow-sm py-2 px-3 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-brand-blue transition-colors"
                        />
                    </div>
                    <button type="submit" disabled={isLoading} className="w-full bg-brand-blue text-white font-bold py-3 px-4 rounded-md hover:bg-brand-blue/80 transition-all duration-300 disabled:bg-slate-400 dark:disabled:bg-slate-600 disabled:cursor-not-allowed flex items-center justify-center shadow-lg shadow-brand-blue/30 hover:shadow-brand-blue/40 hover:-translate-y-0.5 disabled:transform-none disabled:shadow-none">
                        {isLoading ? <Spinner /> : 'Generate Campaign Plan'}
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
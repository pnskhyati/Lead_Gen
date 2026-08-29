import React, { useState, useEffect } from 'react';
import Card from './common/Card';
import Chart from './common/Chart';
import LeadBadge from './common/LeadBadge';
import type { View, ChartData, Lead, LeadTemperature } from '../types';
import { BRAND_PRODUCTS } from '../constants';
import { getLeads, getLeadCounts, updateLeadStatus } from '../services/leadStore';
import InstagramConnect from './InstagramConnect';

interface DashboardProps {
    setCurrentView: (view: View) => void;
}

const KPICard: React.FC<{ title: string; value: string; change: string; icon: React.ReactNode; changeColor: string; tint: string }> = ({ title, value, change, icon, changeColor, tint }) => (
    <Card className="!p-5">
        <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-ink-muted">{title}</p>
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${tint}`}>{icon}</div>
        </div>
        <p className="text-3xl font-extrabold text-ink mt-3 tracking-tight">{value}</p>
        <p className={`text-sm mt-1 font-medium ${changeColor}`}>{change}</p>
    </Card>
);

const QuickAction: React.FC<{ title: string; description: string; onClick: () => void; icon: React.ReactNode; tint: string }> = ({ title, description, onClick, icon, tint }) => (
     <button onClick={onClick} className="w-full text-left bg-soft-bg/70 hover:bg-white p-4 rounded-3xl border border-transparent hover:border-white hover:shadow-soft transition-all duration-200 flex items-center gap-4">
        <div className={`flex-shrink-0 w-11 h-11 rounded-2xl flex items-center justify-center ${tint}`}>
            {icon}
        </div>
        <div>
            <h4 className="font-bold text-ink">{title}</h4>
            <p className="text-xs text-ink-muted mt-0.5">{description}</p>
        </div>
     </button>
);

const generateSampleSalesData = (days: number, brand: string): { name: string; value: number }[] => {
    const data = [];
    const today = new Date();
    const seed = brand.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);

    for (let i = days - 1; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        
        const dayOfWeek = date.getDay();
        const baseSales = 20000 + (seed % 15000); 
        const weekendBoost = (dayOfWeek === 0 || dayOfWeek === 6) ? baseSales * 0.5 : 0;
        const randomFactor = (Math.sin(seed + i) * 10000) / 2;
        const trend = (days - i) * (seed % 100);

        const sales = baseSales + weekendBoost + randomFactor + trend;

        data.push({
            name: date.toISOString().split('T')[0],
            value: Math.max(5000, Math.round(sales))
        });
    }
    return data;
};

const TEMP_FILTERS: Array<'all' | LeadTemperature> = ['all', 'hot', 'warm', 'cold'];

const Dashboard: React.FC<DashboardProps> = ({ setCurrentView }) => {
    const [selectedBrand, setSelectedBrand] = useState<string>('Johnnie Walker');
    const [salesData, setSalesData] = useState<ChartData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [leads, setLeads] = useState<Lead[]>([]);
    const [leadFilter, setLeadFilter] = useState<'all' | LeadTemperature>('all');

    const refreshLeads = () => {
        setLeads(getLeads());
    };

    useEffect(() => {
        refreshLeads();
        const onUpdate = () => refreshLeads();
        window.addEventListener('nexora-leads-updated', onUpdate);
        window.addEventListener('storage', onUpdate);
        return () => {
            window.removeEventListener('nexora-leads-updated', onUpdate);
            window.removeEventListener('storage', onUpdate);
        };
    }, []);

    useEffect(() => {
        setIsLoading(true);
        const timer = setTimeout(() => {
            setSalesData({
                title: `Daily Sales Volume for ${selectedBrand} (Units)`,
                data: generateSampleSalesData(120, selectedBrand),
            });
            setIsLoading(false);
        }, 500);

        return () => clearTimeout(timer);
    }, [selectedBrand]);

    const counts = getLeadCounts();
    const filteredLeads = leadFilter === 'all' ? leads : leads.filter((l) => l.temperature === leadFilter);

    const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = (props) => (
        <select
            {...props}
            className="w-full sm:w-64 nexora-input py-2.5 px-4 text-sm font-semibold text-ink !rounded-full"
        >
            {props.children}
        </select>
    );

    return (
        <div className="space-y-6">
             <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="font-display text-4xl font-semibold text-ink tracking-tight">Insights</h1>
                    <p className="text-ink-muted mt-1 font-medium">Lead pipeline and brand digital health.</p>
                </div>
                <div>
                    <label htmlFor="brand-selector" className="sr-only">Select a Brand</label>
                    <Select
                        id="brand-selector"
                        value={selectedBrand}
                        onChange={(e) => setSelectedBrand(e.target.value)}
                    >
                        {BRAND_PRODUCTS.sort().map(product => (
                            <option key={product} value={product}>
                                {product}
                            </option>
                        ))}
                    </Select>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <KPICard 
                    title="Hot Leads" 
                    value={String(counts.hot)} 
                    change="Ready to buy / strong intent"
                    tint="bg-soft-coral/20 text-soft-coral"
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" /></svg>}
                    changeColor="text-soft-coral"
                />
                 <KPICard 
                    title="Warm Leads" 
                    value={String(counts.warm)} 
                    change="Interested — nurture next"
                    tint="bg-amber-50 text-amber-600"
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v2m0 14v2m9-9h-2M5 12H3m15.364 6.364l-1.414-1.414M7.05 7.05L5.636 5.636m12.728 0L16.95 7.05M7.05 16.95l-1.414 1.414M12 8a4 4 0 100 8 4 4 0 000-8z" /></svg>}
                    changeColor="text-amber-600"
                />
                 <KPICard 
                    title="Cold Leads" 
                    value={String(counts.cold)} 
                    change="Low intent — stay light-touch"
                    tint="bg-soft-sky text-soft-azure"
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" /></svg>}
                    changeColor="text-soft-azure"
                />
            </div>

            <InstagramConnect
                compact
                onSynced={() => refreshLeads()}
            />

            <Card>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                    <div>
                        <h3 className="text-lg font-bold text-ink">Live leads</h3>
                        <p className="text-sm text-ink-muted">From Automation interactions — scored Hot / Warm / Cold</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {TEMP_FILTERS.map((f) => (
                            <button
                                key={f}
                                type="button"
                                onClick={() => setLeadFilter(f)}
                                className={`px-3 py-1.5 rounded-full text-xs font-bold capitalize transition-all ${
                                    leadFilter === f
                                        ? 'bg-gradient-to-r from-soft-deep to-soft-azure text-white shadow-aqua'
                                        : 'bg-soft-bg text-ink-muted hover:bg-white'
                                }`}
                            >
                                {f}
                            </button>
                        ))}
                        <button
                            type="button"
                            onClick={() => setCurrentView('automation')}
                            className="px-3 py-1.5 rounded-full text-xs font-bold bg-soft-mint text-soft-deep"
                        >
                            + Capture lead
                        </button>
                    </div>
                </div>
                {filteredLeads.length === 0 ? (
                    <div className="text-center py-10 text-ink-muted text-sm">
                        No leads yet. Open Automation, paste a comment, and score it.
                    </div>
                ) : (
                    <ul className="space-y-3">
                        {filteredLeads.slice(0, 12).map((lead) => (
                            <li key={lead.id} className="bg-soft-bg/70 rounded-3xl px-4 py-3.5 flex flex-col sm:flex-row sm:items-start gap-3">
                                <div className="flex-1 min-w-0">
                                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                                        <LeadBadge temperature={lead.temperature} score={lead.score} />
                                        <span className="text-xs font-semibold text-ink-muted">{lead.platform}</span>
                                        {lead.source === 'instagram' && (
                                            <span className="text-[10px] font-bold uppercase tracking-wide text-soft-azure bg-soft-sky px-2 py-0.5 rounded-full">
                                              IG{lead.author ? ` · @${lead.author}` : ''}
                                            </span>
                                        )}
                                        {lead.recommendedProduct && (
                                            <span className="text-xs font-semibold text-ink-soft truncate">{lead.recommendedProduct}</span>
                                        )}
                                    </div>
                                    <p className="text-sm text-ink line-clamp-2">“{lead.customerComment}”</p>
                                    <p className="text-xs text-ink-muted mt-1.5">{lead.intentSummary}</p>
                                </div>
                                <div className="flex sm:flex-col items-center sm:items-end gap-2 shrink-0">
                                    <select
                                        value={lead.status}
                                        onChange={(e) => {
                                            updateLeadStatus(lead.id, e.target.value as Lead['status']);
                                            refreshLeads();
                                        }}
                                        className="text-xs font-semibold bg-white rounded-full px-3 py-1.5 text-ink border-0 focus:outline-none focus:ring-2 focus:ring-soft-sky"
                                    >
                                        <option value="new">New</option>
                                        <option value="contacted">Contacted</option>
                                        <option value="qualified">Qualified</option>
                                        <option value="closed">Closed</option>
                                    </select>
                                    <span className="text-[11px] text-ink-muted whitespace-nowrap">
                                        {new Date(lead.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                <div className="lg:col-span-2">
                    <Card className="h-full">
                        <Chart chartData={salesData} isLoading={isLoading} />
                    </Card>
                </div>
                <div className="space-y-5">
                    <Card className="bg-soft-foam/80 !border-soft-sky/50">
                        <h3 className="text-lg font-bold text-ink mb-3">Trending Topics</h3>
                        <ul className="space-y-3 text-sm">
                            <li className="flex justify-between items-center bg-white/80 rounded-2xl px-3 py-2.5"><span className="font-semibold text-ink-soft">#SustainableSpirits</span> <span className="text-xs font-bold text-soft-deep bg-soft-mint px-2 py-1 rounded-full">High</span></li>
                            <li className="flex justify-between items-center bg-white/80 rounded-2xl px-3 py-2.5"><span className="font-semibold text-ink-soft">Don Julio Cocktails</span> <span className="text-xs font-bold text-soft-azure bg-soft-sky px-2 py-1 rounded-full">Med</span></li>
                            <li className="flex justify-between items-center bg-white/80 rounded-2xl px-3 py-2.5"><span className="font-semibold text-ink-soft">Guinness Ad Campaign</span> <span className="text-xs font-bold text-soft-deep bg-soft-mint px-2 py-1 rounded-full">High</span></li>
                            <li className="flex justify-between items-center bg-white/80 rounded-2xl px-3 py-2.5"><span className="font-semibold text-ink-soft">Johnnie Walker Heritage</span> <span className="text-xs font-bold text-ink-muted bg-soft-bg px-2 py-1 rounded-full">Low</span></li>
                        </ul>
                    </Card>
                    <Card>
                         <h3 className="text-lg font-bold text-ink mb-4">Quick Actions</h3>
                         <div className="space-y-3">
                            <QuickAction 
                                title="Capture a lead" 
                                description="Score a comment as Hot / Warm / Cold"
                                onClick={() => setCurrentView('automation')}
                                tint="bg-soft-mint text-soft-deep"
                                icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>}
                            />
                            <QuickAction 
                                title="Creative Lab" 
                                description="Launch the GenAI Content Studio"
                                onClick={() => setCurrentView('lab')}
                                tint="bg-soft-sky text-soft-azure"
                                icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>}
                            />
                         </div>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;

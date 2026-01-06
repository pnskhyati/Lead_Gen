import React, { useState, useEffect } from 'react';
import Card from './common/Card';
import Chart from './common/Chart';
import type { View, ChartData } from '../types';
import { BRAND_PRODUCTS } from '../constants';

interface DashboardProps {
    setCurrentView: (view: View) => void;
}

interface KpiData {
    sentiment: { value: string; change: string; color: string; };
    mentions: { value: string; change: string; color: string; };
    marketShare: { value: string; change: string; color: string; };
}

const KPICard: React.FC<{ title: string; value: string; change: string; icon: React.ReactNode; changeColor: string }> = ({ title, value, change, icon, changeColor }) => (
    <Card>
        <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
            <div className="text-brand-blue">{icon}</div>
        </div>
        <p className="text-3xl font-bold text-slate-900 dark:text-white mt-2">{value}</p>
        <p className={`text-sm mt-1 ${changeColor}`}>{change}</p>
    </Card>
);

const QuickAction: React.FC<{ title: string; description: string; onClick: () => void; icon: React.ReactNode }> = ({ title, description, onClick, icon }) => (
     <button onClick={onClick} className="w-full text-left bg-slate-100/50 hover:bg-slate-200/60 dark:bg-slate-800/50 dark:hover:bg-slate-800/80 p-4 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-brand-blue/50 transition-all duration-200 flex items-center gap-4">
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-white dark:bg-slate-900 border-2 border-brand-blue/50 flex items-center justify-center">
            {icon}
        </div>
        <div>
            <h4 className="font-bold text-slate-800 dark:text-white">{title}</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>
        </div>
     </button>
);

// Helper to generate realistic-looking sample time-series data, seeded by brand
const generateSampleSalesData = (days: number, brand: string): { name: string; value: number }[] => {
    const data = [];
    const today = new Date();
    // Use the brand name to create a simple hash for seeding randomness
    const seed = brand.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);

    for (let i = days - 1; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        
        const dayOfWeek = date.getDay();
        // Base sales vary based on brand "popularity" (seeded hash)
        const baseSales = 20000 + (seed % 15000); 
        const weekendBoost = (dayOfWeek === 0 || dayOfWeek === 6) ? baseSales * 0.5 : 0;
        // Seeded random factor
        const randomFactor = (Math.sin(seed + i) * 10000) / 2;
        const trend = (days - i) * (seed % 100);

        const sales = baseSales + weekendBoost + randomFactor + trend;

        data.push({
            name: date.toISOString().split('T')[0], // YYYY-MM-DD format
            value: Math.max(5000, Math.round(sales)) // Ensure sales are not negative
        });
    }
    return data;
};

// Helper to generate mock KPIs based on the brand name
const generateMockKpis = (brand: string): KpiData => {
    const seed = brand.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    
    const sentiments = ['Positive', 'Neutral', 'Mixed'];
    const changes = [2.5, 1.2, -0.5, 5.1, -3.2];
    
    const sentimentChange = changes[seed % changes.length];
    const mentionsChange = changes[(seed + 1) % changes.length] * 3;
    // FIX: `marketShareChange` was a string, causing a type error when comparing with a number.
    // Introduced `marketShareChangeNum` for numeric comparison and kept `marketShareChange` as the formatted string.
    const marketShareChangeNum = (changes[(seed + 2) % changes.length] / 10);
    const marketShareChange = marketShareChangeNum.toFixed(1);

    return {
        sentiment: {
            value: sentiments[seed % sentiments.length],
            change: `${sentimentChange > 0 ? '+' : ''}${sentimentChange.toFixed(1)}% vs last week`,
            color: sentimentChange >= 0 ? 'text-green-500 dark:text-green-400' : 'text-red-500 dark:text-red-400',
        },
        mentions: {
            value: `${((seed % 15) + 5).toFixed(1)}K`,
            change: `${mentionsChange > 0 ? '+' : ''}${mentionsChange.toFixed(1)}% vs last week`,
            color: mentionsChange >= 0 ? 'text-green-500 dark:text-green-400' : 'text-red-500 dark:text-red-400',
        },
        marketShare: {
            value: `${((seed % 10) + 15).toFixed(1)}%`,
            change: `${marketShareChangeNum > 0 ? '+' : ''}${marketShareChange}% vs last quarter`,
            color: marketShareChangeNum >= 0 ? 'text-green-500 dark:text-green-400' : 'text-red-500 dark:text-red-400',
        },
    };
};

const Dashboard: React.FC<DashboardProps> = ({ setCurrentView }) => {
    const [selectedBrand, setSelectedBrand] = useState<string>('Johnnie Walker');
    const [salesData, setSalesData] = useState<ChartData | null>(null);
    const [kpiData, setKpiData] = useState<KpiData | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Simulate fetching data for the selected brand
        setIsLoading(true);
        // Add a slight delay to make the loading state visible and feel responsive
        const timer = setTimeout(() => {
            const newKpis = generateMockKpis(selectedBrand);
            const newSalesData: ChartData = {
                title: `Daily Sales Volume for ${selectedBrand} (Units)`,
                data: generateSampleSalesData(120, selectedBrand),
            };
            setKpiData(newKpis);
            setSalesData(newSalesData);
            setIsLoading(false);
        }, 500);

        return () => clearTimeout(timer); // Cleanup timer on unmount or re-run
    }, [selectedBrand]);

    const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = (props) => (
        <select
            {...props}
            className="w-full sm:w-64 bg-white/50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-md shadow-sm py-2 px-3 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-brand-blue transition-colors"
        >
            {props.children}
        </select>
    );

    return (
        <div className="animate-fade-in space-y-8">
             <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Insights Dashboard</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">A real-time overview of your brand's digital ecosystem.</p>
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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <KPICard 
                    title="Global Sentiment" 
                    value={isLoading ? '...' : kpiData?.sentiment.value ?? 'N/A'} 
                    change={isLoading ? '...' : kpiData?.sentiment.change ?? ''} 
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                    changeColor={isLoading ? 'text-slate-400' : kpiData?.sentiment.color ?? 'text-slate-400'}
                />
                 <KPICard 
                    title="Media Mentions" 
                    value={isLoading ? '...' : kpiData?.mentions.value ?? 'N/A'} 
                    change={isLoading ? '...' : kpiData?.mentions.change ?? ''} 
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3h3m-3 4h3m-3 4h3m-3 4h3" /></svg>}
                    changeColor={isLoading ? 'text-slate-400' : kpiData?.mentions.color ?? 'text-slate-400'}
                />
                 <KPICard 
                    title="Market Share (Est.)" 
                    value={isLoading ? '...' : kpiData?.marketShare.value ?? 'N/A'} 
                    change={isLoading ? '...' : kpiData?.marketShare.change ?? ''} 
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" /></svg>}
                    changeColor={isLoading ? 'text-slate-400' : kpiData?.marketShare.color ?? 'text-slate-400'}
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <Card className="h-full">
                        <Chart chartData={salesData} isLoading={isLoading} />
                    </Card>
                </div>
                <div className="space-y-4">
                    <Card>
                        <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">Trending Topics</h3>
                        <ul className="space-y-2 text-sm">
                            <li className="flex justify-between text-slate-600 dark:text-slate-300"><span>#SustainableSpirits</span> <span className="text-green-500 dark:text-green-400">▲ High</span></li>
                            <li className="flex justify-between text-slate-600 dark:text-slate-300"><span>Don Julio Cocktails</span> <span className="text-amber-500 dark:text-amber-400">▶ Med</span></li>
                            <li className="flex justify-between text-slate-600 dark:text-slate-300"><span>Guinness Ad Campaign</span> <span className="text-green-500 dark:text-green-400">▲ High</span></li>
                            <li className="flex justify-between text-slate-600 dark:text-slate-300"><span>Johnnie Walker Heritage</span> <span className="text-slate-400 dark:text-slate-400">▼ Low</span></li>
                        </ul>
                    </Card>
                    <Card>
                         <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">Quick Actions</h3>
                         <div className="space-y-3">
                            <QuickAction 
                                title="Creative Lab" 
                                description="Launch the GenAI Content Studio"
                                onClick={() => setCurrentView('lab')}
                                icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-brand-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>}
                            />
                             <QuickAction 
                                title="Ask AI Assistant" 
                                description="Query for marketing intelligence"
                                onClick={() => setCurrentView('chat')}
                                icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-brand-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>}
                            />
                         </div>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
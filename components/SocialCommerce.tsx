import React, { useState, useCallback } from 'react';
import { SOCIAL_PLATFORMS } from '../constants';
import type { SocialInteraction, SocialResponse, Lead } from '../types';
import { generateSocialReply, generateImage } from '../services/geminiService';
import { addLeadFromInteraction } from '../services/leadStore';
import Spinner from './common/Spinner';
import Card from './common/Card';
import LeadBadge from './common/LeadBadge';
import InstagramConnect from './InstagramConnect';

const Label: React.FC<{ htmlFor: string; children: React.ReactNode }> = ({ htmlFor, children }) => (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{children}</label>
);

const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement> & { options: string[] }> = ({ id, value, onChange, options }) => (
    <select
        id={id}
        value={value}
        onChange={onChange}
        className="w-full bg-soft-bg border border-transparent rounded-2xl py-2.5 px-4 text-ink focus:outline-none focus:ring-4 focus:ring-soft-sky/60 focus:bg-white transition-all"
    >
        {options.map(option => <option key={option} value={option}>{option}</option>)}
    </select>
);

const TextArea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = (props) => (
    <textarea
        {...props}
        className="w-full bg-soft-bg border border-transparent rounded-2xl py-2.5 px-4 text-ink focus:outline-none focus:ring-4 focus:ring-soft-sky/60 focus:bg-white transition-all"
    />
);


const SocialCommerce: React.FC = () => {
    const [details, setDetails] = useState<SocialInteraction>({
        platform: SOCIAL_PLATFORMS[0],
        customerComment: `Just saw the new Johnnie Walker ad, looks amazing! I'm looking for a smooth whisky for a weekend get-together, any suggestions?`,
    });
    const [generatedResponse, setGeneratedResponse] = useState<SocialResponse | null>(null);
    const [capturedLead, setCapturedLead] = useState<Lead | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [productImageUrl, setProductImageUrl] = useState<string | null>(null);
    const [isGeneratingImage, setIsGeneratingImage] = useState(false);

    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLSelectElement | HTMLTextAreaElement>) => {
        const { id, value } = e.target;
        setDetails(prev => ({ ...prev, [id]: value }));
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);
        setGeneratedResponse(null);
        setCapturedLead(null);
        setProductImageUrl(null);
        setIsGeneratingImage(false);

        try {
            const response = await generateSocialReply(details);
            setGeneratedResponse(response);
            const lead = addLeadFromInteraction(details, response);
            setCapturedLead(lead);
             if (response?.productRecommendation?.productImagePrompt) {
                setIsGeneratingImage(true);
                try {
                    const imageUrl = await generateImage(response.productRecommendation.productImagePrompt);
                    setProductImageUrl(imageUrl);
                } catch (imgError) {
                    console.error("Failed to generate product recommendation image:", imgError);
                    setProductImageUrl(null);
                } finally {
                    setIsGeneratingImage(false);
                }
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unknown error occurred.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fade-in">
            <div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-1">Lead Automation</h1>
                <p className="text-slate-500 dark:text-slate-400 mb-6">Score Instagram comments (Graph API) or paste a message as Hot / Warm / Cold.</p>
                <div className="mb-5">
                    <InstagramConnect />
                </div>
                <Card>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <Label htmlFor="platform">Social Platform</Label>
                            <Select id="platform" value={details.platform} onChange={handleInputChange} options={SOCIAL_PLATFORMS} />
                        </div>
                        <div>
                            <Label htmlFor="customerComment">Customer Comment / DM</Label>
                            <TextArea id="customerComment" value={details.customerComment} onChange={handleInputChange} rows={5} placeholder="Paste customer's message here..." />
                        </div>
                        <button type="submit" disabled={isLoading} className="nexora-btn-primary w-full py-3.5 px-4 text-sm flex items-center justify-center gap-2">
                            {isLoading ? <Spinner /> : 'Score lead & generate reply'}
                        </button>
                    </form>
                </Card>
            </div>
            
            <div className="min-h-[300px]">
                <h2 className="text-3xl font-semibold text-slate-900 dark:text-white mb-6">AI Generated Response</h2>
                {isLoading && (
                    <Card className="flex flex-col items-center justify-center h-full text-slate-500 dark:text-slate-400">
                        <Spinner />
                        <p className="mt-2">Scoring lead intent and crafting reply...</p>
                    </Card>
                )}
                {error && <div className="text-red-500 dark:text-red-400 bg-red-500/10 dark:bg-red-900/50 p-4 rounded-md">{error}</div>}
                {generatedResponse && !isLoading && (
                    <div className="space-y-6 animate-fade-in">
                        {capturedLead && (
                            <Card className="!p-4 bg-soft-bg/80">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Lead captured</p>
                                        <p className="text-sm text-ink mt-1">{capturedLead.intentSummary}</p>
                                    </div>
                                    <LeadBadge temperature={capturedLead.temperature} score={capturedLead.score} />
                                </div>
                                <p className="text-xs text-ink-muted mt-3">Visible on Insights dashboard · {capturedLead.platform}</p>
                            </Card>
                        )}
                        <div>
                            <h3 className="text-lg font-semibold text-brand-blue mb-3">Suggested Reply</h3>
                            <Card>
                                <p className="text-slate-700 dark:text-slate-300 text-sm whitespace-pre-wrap">{generatedResponse.suggestedReply}</p>
                            </Card>
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-brand-blue mb-3">Product Recommendation</h3>
                            <Card className="flex flex-col sm:flex-row items-center gap-4">
                                <div className="w-28 h-28 flex-shrink-0 bg-slate-100 dark:bg-slate-900/50 rounded-lg p-2 flex items-center justify-center relative">
                                    {isGeneratingImage && (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 rounded-lg">
                                            <Spinner />
                                            <span className="text-xs text-slate-400 mt-2 text-center">Generating...</span>
                                        </div>
                                    )}
                                    {!isGeneratingImage && productImageUrl && (
                                        <img 
                                            src={productImageUrl} 
                                            alt={generatedResponse.productRecommendation.name} 
                                            className="max-w-full max-h-full object-contain"
                                        />
                                    )}
                                    {!isGeneratingImage && !productImageUrl && (
                                        <div className="text-center text-slate-400 dark:text-slate-500 p-1">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-6 w-6 text-red-500/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            <span className="text-xs mt-1 block">Image Failed</span>
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 text-center sm:text-left">
                                    <p className="font-bold text-slate-900 dark:text-white text-lg">{generatedResponse.productRecommendation.name}</p>
                                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{generatedResponse.productRecommendation.reasoning}</p>
                                </div>
                            </Card>
                        </div>
                         {generatedResponse.productRecommendation.recipes && generatedResponse.productRecommendation.recipes.length > 0 && (
                            <div>
                                <h3 className="text-lg font-semibold text-brand-blue mb-3">Cocktail Ideas</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {generatedResponse.productRecommendation.recipes.map((recipe, index) => (
                                        <Card key={index} className="flex flex-col">
                                            <h4 className="font-bold text-slate-800 dark:text-white mb-2 text-base">{recipe.name}</h4>
                                            <ul className="space-y-1.5 text-sm text-slate-500 dark:text-slate-400 list-disc list-inside">
                                                {recipe.ingredients.map((ingredient, i) => (
                                                    <li key={i}>{ingredient}</li>
                                                ))}
                                            </ul>
                                        </Card>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
                 {!generatedResponse && !isLoading && !error && (
                    <Card className="flex items-center justify-center h-full text-slate-400 dark:text-slate-500">
                        <p>Lead score and AI reply will appear here.</p>
                    </Card>
                 )}
            </div>
        </div>
    );
};

export default SocialCommerce;

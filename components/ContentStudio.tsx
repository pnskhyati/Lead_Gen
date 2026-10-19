import React, { useState, useCallback, useEffect } from 'react';
import { CAMPAIGN_GOALS, BRAND_PRODUCTS_BY_CATEGORY, PLATFORMS, AUDIENCE_SUGGESTIONS } from '../constants';
import type { CampaignDetails, GeneratedContent, LinkedInDraft } from '../types';
import { generateContentIdeas, generateImage, generatePromoVideo, generateProductShowcase } from '../services/geminiService';
import Spinner from './common/Spinner';
import Card from './common/Card';
import BrandVoiceField, { type BrandVoiceValue } from './common/BrandVoiceField';

interface ContentStudioProps {
    openLinkedInHub?: (drafts?: LinkedInDraft[], brief?: string) => void;
}

const Label: React.FC<{ htmlFor?: string; children: React.ReactNode }> = ({ htmlFor, children }) => (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{children}</label>
);

const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = (props) => (
    <select
        {...props}
        className="w-full bg-soft-bg border border-transparent rounded-2xl py-2.5 px-4 text-ink focus:outline-none focus:ring-4 focus:ring-soft-sky/60 focus:bg-white transition-all"
    >
        {props.children}
    </select>
);

const TextArea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = (props) => (
    <textarea
        {...props}
        className="w-full bg-soft-bg border border-transparent rounded-2xl py-2.5 px-4 text-ink focus:outline-none focus:ring-4 focus:ring-soft-sky/60 focus:bg-white transition-all"
    />
);


const ContentStudio: React.FC<ContentStudioProps> = ({ openLinkedInHub }) => {
    const [selectedSector, setSelectedSector] = useState<string>(BRAND_PRODUCTS_BY_CATEGORY[0].category);
    const [details, setDetails] = useState<CampaignDetails>({
        product: BRAND_PRODUCTS_BY_CATEGORY[0].products[0],
        goal: CAMPAIGN_GOALS[0],
        audience: AUDIENCE_SUGGESTIONS[PLATFORMS[0]],
        platform: PLATFORMS[0],
        tone: 'Sophisticated & Premium',
        voiceMode: 'company',
        customTone: '',
    });
    const [generatedContent, setGeneratedContent] = useState<GeneratedContent | null>(null);
    const [generatedImages, setGeneratedImages] = useState<(string | null)[]>([]);
    const [isGeneratingImages, setIsGeneratingImages] = useState<boolean[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({});

    const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
    const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
    const [videoError, setVideoError] = useState<string | null>(null);
    const [videoBaseImageIndex, setVideoBaseImageIndex] = useState<number | null>(null);
    const [videoTextPrompt, setVideoTextPrompt] = useState<string>('');

    const [productShowcaseDesc, setProductShowcaseDesc] = useState<string | null>(null);
    const [productShowcaseImg, setProductShowcaseImg] = useState<string | null>(null);
    const [isProductShowcaseLoading, setIsProductShowcaseLoading] = useState(true);
    const [productShowcaseError, setProductShowcaseError] = useState<string | null>(null);

    useEffect(() => {
        if (!details.product) return;

        const controller = new AbortController();
        let cancelled = false;

        const fetchProductShowcase = async () => {
            setIsProductShowcaseLoading(true);
            setProductShowcaseError(null);
            setProductShowcaseDesc(null);
            setProductShowcaseImg(null);

            try {
                const showcaseData = await generateProductShowcase(details.product);
                if (cancelled) return;

                setProductShowcaseDesc(showcaseData.description);

                if (showcaseData.imageUrl) {
                    setProductShowcaseImg(showcaseData.imageUrl);
                } else if (showcaseData.imagePrompt) {
                    try {
                        const imageUrl = await generateImage(showcaseData.imagePrompt);
                        if (!cancelled) setProductShowcaseImg(imageUrl);
                    } catch (imageErr) {
                        console.error("Product showcase image failed:", imageErr);
                        // Keep description; preview still useful without image
                    }
                }
            } catch (err) {
                if (cancelled || (err instanceof DOMException && err.name === 'AbortError')) return;
                console.error("Failed to fetch product showcase:", err);
                setProductShowcaseError("Could not load product preview.");
            } finally {
                if (!cancelled) setIsProductShowcaseLoading(false);
            }
        };

        fetchProductShowcase();
        return () => {
            cancelled = true;
            controller.abort();
        };
    }, [details.product]);

    const handleSectorChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newSector = e.target.value;
        setSelectedSector(newSector);

        const sectorProducts = BRAND_PRODUCTS_BY_CATEGORY.find(
            (sector) => sector.category === newSector
        )?.products;

        if (sectorProducts && sectorProducts.length > 0) {
            setDetails((prevDetails) => ({
                ...prevDetails,
                product: sectorProducts[0],
            }));
        }
    };

    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLSelectElement | HTMLTextAreaElement>) => {
        const { id, value } = e.target;

        if (id === 'platform') {
            const newAudience = AUDIENCE_SUGGESTIONS[value] || '';
            const isDefaultAudience = Object.values(AUDIENCE_SUGGESTIONS).includes(details.audience);
    
            if (isDefaultAudience) {
                setDetails(prev => ({
                    ...prev,
                    platform: value,
                    audience: newAudience
                }));
            } else {
                setDetails(prev => ({ ...prev, platform: value }));
            }
        } else {
            setDetails(prev => ({ ...prev, [id]: value }));
        }
    }, [details.audience]);
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);
        setGeneratedContent(null);
        setGeneratedImages([]);
        setIsGeneratingImages([]);
        setGeneratedVideoUrl(null);
        setVideoError(null);
        setCopiedStates({});
        setVideoBaseImageIndex(null);
        setVideoTextPrompt('');
        
        try {
            const content = await generateContentIdeas(details);
            setGeneratedContent(content);
            setVideoTextPrompt(content.videoScript);
            setVideoBaseImageIndex(0); // Default to the first image
            setIsLoading(false);

            if (content && content.imagePrompts) {
                const prompts = content.imagePrompts;
                setGeneratedImages(new Array(prompts.length).fill(null));
                setIsGeneratingImages(new Array(prompts.length).fill(true));
                
                prompts.forEach(async (prompt, index) => {
                    try {
                        const imageUrl = await generateImage(prompt);
                        setGeneratedImages(prevImages => {
                            const newImages = [...prevImages];
                            newImages[index] = imageUrl;
                            return newImages;
                        });
                    } catch (imgError) {
                        console.error(`Error generating image for prompt ${index + 1}:`, imgError);
                    } finally {
                        setIsGeneratingImages(prevLoading => {
                            const newLoading = [...prevLoading];
                            newLoading[index] = false;
                            return newLoading;
                        });
                    }
                });
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unknown error occurred.');
            setIsLoading(false);
        }
    };

    const handleGenerateVideo = async () => {
        if (videoBaseImageIndex === null || !generatedContent?.imagePrompts[videoBaseImageIndex] || !videoTextPrompt.trim()) {
            setVideoError("Please select an image concept and ensure the video prompt is not empty.");
            return;
        }

        setIsGeneratingVideo(true);
        setVideoError(null);
        setGeneratedVideoUrl(null);

        try {
            const imagePrompt = generatedContent.imagePrompts[videoBaseImageIndex];
            
            const videoUrl = await generatePromoVideo(videoTextPrompt, imagePrompt);
            setGeneratedVideoUrl(videoUrl);

        } catch (err) {
            setVideoError(err instanceof Error ? err.message : 'An unknown error occurred during video generation.');
        } finally {
            setIsGeneratingVideo(false);
        }
    };

    const handleCopy = (text: string, id: string) => {
        navigator.clipboard.writeText(text).then(() => {
            setCopiedStates(prev => ({ ...prev, [id]: true }));
            setTimeout(() => setCopiedStates(prev => ({ ...prev, [id]: false })), 2000);
        }).catch(err => console.error('Failed to copy text: ', err));
    };

    const handleShare = () => {
        const platformLinks: Record<string, string> = {
            "Instagram Post": "https://www.instagram.com/",
            "Instagram Story": "https://www.instagram.com/",
            "TikTok Video": "https://www.tiktok.com/",
            "Facebook Ad": "https://www.facebook.com/adsmanager/",
            "YouTube Short": "https://studio.youtube.com/channel/UC/videos?d=ud",
            "LinkedIn Post": "https://www.linkedin.com/shareArticle?mini=true&text=",
        };

        const baseUrl = platformLinks[details.platform];
        if (!baseUrl) return;

        let shareUrl = baseUrl;
        if (details.platform === 'LinkedIn Post' && generatedContent?.captions[0]) {
            shareUrl += encodeURIComponent(generatedContent.captions[0]);
        }
        
        window.open(shareUrl, '_blank', 'noopener,noreferrer');
    };

    const handleScheduleOnLinkedIn = () => {
        if (!generatedContent?.captions?.length || !openLinkedInHub) return;

        const selectedImage =
            (videoBaseImageIndex !== null && generatedImages[videoBaseImageIndex]) ||
            generatedImages.find(Boolean) ||
            undefined;
        const selectedPrompt =
            (videoBaseImageIndex !== null && generatedContent.imagePrompts[videoBaseImageIndex]) ||
            generatedContent.imagePrompts[0] ||
            '';

        const drafts: LinkedInDraft[] = generatedContent.captions.map((caption, i) => {
            const lines = caption.split('\n').map(l => l.trim()).filter(Boolean);
            const headline = lines[0]?.slice(0, 120) || `LinkedIn Post ${i + 1}`;
            const content = lines.length > 1 ? lines.slice(1).join('\n\n') : caption;
            const hashtagMatches = caption.match(/#[\w]+/g) || [];
            return {
                headline,
                content,
                hashtags: hashtagMatches.map(t => t.replace(/^#/, '')),
                imageUrl: selectedImage || undefined,
                imagePrompt: selectedPrompt,
                source: 'ai-generated' as const,
            };
        });

        openLinkedInHub(drafts);
    };
    
    interface ImagePromptCardProps {
        prompt: string;
        index: number;
        imageUrl: string | null;
        isLoading: boolean;
        isSelected: boolean;
        onSelect: () => void;
    }

    const ImagePromptCard: React.FC<ImagePromptCardProps> = ({ prompt, index, imageUrl, isLoading, isSelected, onSelect }) => (
        <Card className={`flex flex-col md:flex-row gap-4 items-center !border-2 ${isSelected ? '!border-brand-blue' : ''}`}>
            <div className="w-full md:w-1/3 h-48 flex items-center justify-center bg-slate-200 dark:bg-slate-900/50 rounded-md overflow-hidden relative group">
                {isLoading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50">
                        <Spinner />
                        <span className="text-xs text-slate-400 mt-2">Generating...</span>
                    </div>
                )}
                {imageUrl && !isLoading && <img src={imageUrl} alt={`Generated visual concept ${index + 1}`} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />}
                {!imageUrl && !isLoading && (
                     <div className="text-center text-slate-400 dark:text-slate-500 p-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-8 w-8 text-red-500/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 a 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-xs mt-1 block">Image generation failed</span>
                    </div>
                )}
            </div>
            <div className="flex-1 flex flex-col justify-between self-stretch">
                <p className="text-slate-500 dark:text-slate-400 text-sm">{prompt}</p>
                <button 
                    onClick={onSelect}
                    disabled={isLoading || !imageUrl}
                    className={`mt-2 w-full md:w-auto text-xs font-semibold py-1.5 px-3 rounded-md transition-colors duration-200 flex items-center justify-center gap-1.5 ${
                        isSelected 
                        ? 'bg-brand-blue text-white' 
                        : 'bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-500 disabled:cursor-not-allowed'
                    }`}
                >
                    {isSelected ? '✓ Selected for Video' : 'Select for Video'}
                </button>
            </div>
        </Card>
    );

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fade-in">
            <div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-1">Creative Lab</h1>
                <p className="text-slate-500 dark:text-slate-400 mb-6">Define your campaign and let AI generate creative assets.</p>
                <Card>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-4">
                            <div>
                                <Label htmlFor="sector">Sector</Label>
                                <Select
                                    id="sector"
                                    value={selectedSector}
                                    onChange={handleSectorChange}
                                >
                                    {BRAND_PRODUCTS_BY_CATEGORY.map(group => (
                                        <option key={group.category} value={group.category}>
                                            {group.category}
                                        </option>
                                    ))}
                                </Select>
                            </div>
                            {selectedSector && (
                                <div className="animate-fade-in">
                                    <Label htmlFor="product">Brand</Label>
                                    <Select
                                        id="product"
                                        value={details.product}
                                        onChange={handleInputChange}
                                    >
                                        {BRAND_PRODUCTS_BY_CATEGORY
                                            .find(s => s.category === selectedSector)
                                            ?.products.map(product => (
                                                <option key={product} value={product}>
                                                    {product}
                                                </option>
                                            ))
                                        }
                                    </Select>
                                </div>
                            )}
                        </div>
                        
                        {isProductShowcaseLoading && (
                            <div className="flex flex-col items-center justify-center h-40 text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/60 rounded-lg">
                                <Spinner />
                                <p className="mt-2 text-sm">Loading product preview...</p>
                            </div>
                        )}
                        {productShowcaseError && !isProductShowcaseLoading && (
                            <div className="flex flex-col items-center justify-center h-40 text-red-500 dark:text-red-400 bg-red-500/10 dark:bg-red-900/30 rounded-lg">
                                <p>{productShowcaseError}</p>
                            </div>
                        )}
                        {productShowcaseDesc && !isProductShowcaseLoading && (
                            <div className="grid grid-cols-3 gap-4 items-center animate-fade-in p-4 bg-slate-100 dark:bg-slate-800/60 rounded-lg">
                                <div className="col-span-1 h-32 flex items-center justify-center">
                                    {productShowcaseImg ? (
                                        <img src={productShowcaseImg} alt={details.product} className="max-h-full max-w-full object-contain" />
                                    ) : (
                                        <p className="text-xs text-slate-400 text-center px-2">Preview image unavailable</p>
                                    )}
                                </div>
                                <div className="col-span-2">
                                    <p className="text-slate-600 dark:text-slate-300 text-sm">{productShowcaseDesc}</p>
                                </div>
                            </div>
                        )}

                        <div>
                            <Label htmlFor="goal">Campaign Goal</Label>
                            <Select id="goal" value={details.goal} onChange={handleInputChange}>
                                {CAMPAIGN_GOALS.map(option => <option key={option} value={option}>{option}</option>)}
                            </Select>
                        </div>
                        <div>
                            <Label htmlFor="platform">Platform</Label>
                            <Select id="platform" value={details.platform} onChange={handleInputChange}>
                                {PLATFORMS.map(option => <option key={option} value={option}>{option}</option>)}
                            </Select>
                        </div>
                        <div>
                            <BrandVoiceField
                                value={{
                                    voiceMode: details.voiceMode || 'company',
                                    tone: details.tone,
                                    customTone: details.customTone || '',
                                }}
                                onChange={(v: BrandVoiceValue) =>
                                    setDetails((prev) => ({
                                        ...prev,
                                        voiceMode: v.voiceMode,
                                        tone: v.tone,
                                        customTone: v.customTone,
                                    }))
                                }
                            />
                        </div>
                        <div>
                            <Label htmlFor="audience">Target Audience</Label>
                            <TextArea id="audience" value={details.audience} onChange={handleInputChange} rows={3} />
                        </div>
                        <button type="submit" disabled={isLoading} className="nexora-btn-primary w-full py-3.5 px-4 text-sm flex items-center justify-center gap-2">
                            {isLoading ? <Spinner /> : 'Generate Content'}
                        </button>
                    </form>
                </Card>
            </div>
            
            <div className="min-h-[300px]">
                 <h2 className="text-3xl font-semibold text-slate-900 dark:text-white mb-6">Generated Assets</h2>
                {isLoading && (
                    <Card className="flex flex-col items-center justify-center h-full text-slate-500 dark:text-slate-400">
                        <Spinner />
                        <p className="mt-2">Generating creative concepts with Gemini...</p>
                    </Card>
                )}
                {error && <div className="text-red-500 dark:text-red-400 bg-red-500/10 dark:bg-red-900/50 p-4 rounded-md">{error}</div>}
                {generatedContent && !isLoading && (
                    <div className="space-y-6 animate-fade-in">
                        <div>
                            <h3 className="text-lg font-semibold text-brand-blue mb-3">Captions</h3>
                            <div className="space-y-3">
                                {generatedContent.captions.map((caption, i) => (
                                    <div key={i} className="bg-slate-100 dark:bg-slate-800/70 p-3 rounded-md flex justify-between items-start gap-4 border border-slate-200 dark:border-slate-700">
                                        <p className="text-slate-700 dark:text-slate-300 text-sm flex-1 whitespace-pre-wrap pt-1">{caption}</p>
                                        <button
                                            onClick={() => handleCopy(caption, `caption-${i}`)}
                                            title="Copy Caption"
                                            className={`text-xs font-semibold py-1 px-3 rounded-md transition-colors duration-200 flex items-center gap-1.5 flex-shrink-0 ${
                                                copiedStates[`caption-${i}`]
                                                ? 'bg-green-600 text-white'
                                                : 'bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300'
                                            }`}
                                        >
                                            {copiedStates[`caption-${i}`] ? '✓' : 'Copy'}
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-4 space-y-2">
                                {details.platform === 'LinkedIn Post' && openLinkedInHub ? (
                                    <button
                                        onClick={handleScheduleOnLinkedIn}
                                        disabled={!generatedContent?.captions?.length}
                                        className="w-full bg-blue-600 text-white font-bold py-2.5 px-4 rounded-md hover:bg-blue-700 transition-colors duration-200 disabled:bg-slate-400 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.238 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" /></svg>
                                        Schedule on LinkedIn
                                    </button>
                                ) : (
                                    <button
                                        onClick={handleShare}
                                        disabled={!generatedContent?.captions?.length}
                                        className="w-full bg-transparent text-brand-blue font-bold py-2 px-4 rounded-md border border-brand-blue/50 hover:border-brand-blue hover:bg-brand-blue/10 transition-colors duration-200 disabled:border-slate-300 dark:disabled:border-slate-700 disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                        </svg>
                                        Share to {details.platform}
                                    </button>
                                )}
                            </div>
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-brand-blue mb-3">Image Concepts</h3>
                            <div className="space-y-4">
                                {generatedContent.imagePrompts.map((prompt, i) => (
                                    <ImagePromptCard 
                                        key={i} 
                                        prompt={prompt} 
                                        index={i} 
                                        imageUrl={generatedImages[i]} 
                                        isLoading={isGeneratingImages[i]}
                                        isSelected={videoBaseImageIndex === i}
                                        onSelect={() => setVideoBaseImageIndex(i)}
                                    />
                                ))}
                            </div>
                        </div>
                        
                        <div>
                            <h3 className="text-lg font-semibold text-brand-blue mb-3">Video Prompt</h3>
                            <Card>
                                <TextArea 
                                    rows={3} 
                                    value={videoTextPrompt}
                                    onChange={(e) => setVideoTextPrompt(e.target.value)}
                                    placeholder="Enter or edit the prompt for the video..."
                                />
                            </Card>
                        </div>

                         <div>
                            <h3 className="text-lg font-semibold text-brand-blue mb-3">Promotional Video</h3>
                            {!isGeneratingVideo && !generatedVideoUrl && (
                                <button
                                    onClick={handleGenerateVideo}
                                    disabled={videoBaseImageIndex === null || isGeneratingImages.some(s => s) || isGeneratingVideo}
                                    className="w-full bg-transparent text-brand-blue font-bold py-2 px-4 rounded-md border border-brand-blue/50 hover:border-brand-blue hover:bg-brand-blue/10 transition-colors duration-200 disabled:border-slate-300 dark:disabled:border-slate-700 disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-400 disabled:cursor-not-allowed flex items-center justify-center"
                                >
                                    🎬 Generate Video {videoBaseImageIndex !== null ? `(from concept #${videoBaseImageIndex + 1})` : ''}
                                </button>
                            )}
                            {isGeneratingVideo && (
                                <Card className="text-center py-4">
                                    <div className="flex justify-center"><Spinner /></div>
                                    <p className="mt-2 font-semibold text-slate-700 dark:text-slate-300">Sit tight, your video is being created...</p>
                                    <p className="text-sm text-slate-500 dark:text-slate-500 mt-1">This process can take a few minutes.</p>
                                </Card>
                            )}
                            {videoError && (
                                <div className="text-red-500 dark:text-red-400 bg-red-500/10 dark:bg-red-900/50 p-4 rounded-md">{videoError}</div>
                            )}
                            {generatedVideoUrl && !isGeneratingVideo && (
                                 <Card className="p-0 overflow-hidden">
                                    <video controls muted autoPlay loop className="w-full rounded-md" src={generatedVideoUrl}>
                                        Your browser does not support the video tag.
                                    </video>
                                </Card>
                            )}
                        </div>
                    </div>
                )}
                 {!generatedContent && !isLoading && !error && (
                    <Card className="flex items-center justify-center h-full text-slate-400 dark:text-slate-500">
                        <p>Your generated content will appear here.</p>
                    </Card>
                 )}
            </div>
        </div>
    );
};

export default ContentStudio;
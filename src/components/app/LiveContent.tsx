import React, { useCallback, useEffect, useState } from 'react';
import CreativeLabView, { type CreativeLiveGenerateFn } from './CreativeLabView';
import { buildHeroImagePrompt, composeAdImagePrompt } from './creative/visualBriefBuilder';
import {
  buildInstagramCarouselPrompts,
  isInstagramCarouselContent,
  isInstagramPlatform,
} from './creative/instagramCarousel';
import {
  formatTopicSocialPackForSchedule,
  mapTopicSocialToVariation,
} from './creative/socialPostFormat';
import SocialHubView from './SocialHubView';
import type { GeneratedAsset, ScheduledPost, SocialAccount, SubCategory } from '../../types';
import type { GeneratedVariation } from './creative/OutputWorkspace';
import type { BrandContext } from './creative/BrandContextBanner';
import {
  generateContentIdeas,
  generateImage,
  generateTopicSocialPack,
  type TopicSocialPost,
} from '../../legacy/services/geminiService';
import { generatePostsText } from '../../legacy/linkedin/geminiService';
import { getCompanyProfile } from '../../legacy/services/companyService';
import { getInstagramStatus } from '../../legacy/services/instagramService';
import { getFacebookStatus } from '../../legacy/services/facebookService';

const ASSETS_KEY = 'nexora-content-assets';
const SCHEDULE_KEY = 'nexora-scheduled-posts';

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as T;
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

interface LiveContentProps {
  activeSubCategory: SubCategory;
  onNavigateSub: (sub: SubCategory) => void;
  onNotify?: (title: string, desc: string) => void;
  onOpenLinkedInStudio?: () => void;
  onOpenConnections?: () => void;
}

function resolveSocialPlatforms(channel: string): string[] {
  if (!channel || channel.includes('All platforms')) {
    return ['LinkedIn', 'Facebook', 'Instagram', 'X (Twitter)'];
  }
  if (channel.includes('Instagram')) return ['Instagram'];
  if (channel.includes('LinkedIn')) return ['LinkedIn'];
  if (channel.includes('Facebook')) return ['Facebook'];
  if (channel.includes('Twitter') || channel === 'X (Twitter)') return ['X (Twitter)'];
  if (channel.includes('Substack')) return ['Substack Notes'];
  return [channel];
}


async function fetchLinkedInConnected(): Promise<boolean> {
  try {
    const res = await fetch('/api/auth/status', { credentials: 'include' });
    if (!res.ok) return false;
    const json = await res.json();
    return Boolean(json.authenticated || json.data?.authenticated || json.user);
  } catch {
    return false;
  }
}

export default function LiveContent({
  activeSubCategory,
  onNavigateSub,
  onNotify,
  onOpenLinkedInStudio,
  onOpenConnections,
}: LiveContentProps) {
  const [assets, setAssets] = useState<GeneratedAsset[]>(() => loadJson(ASSETS_KEY, []));
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>(() => loadJson(SCHEDULE_KEY, []));
  const [brandContext, setBrandContext] = useState<BrandContext | undefined>();
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);

  useEffect(() => {
    try {
      localStorage.setItem(ASSETS_KEY, JSON.stringify(assets.slice(0, 100)));
    } catch {
      /* ignore quota */
    }
  }, [assets]);

  useEffect(() => {
    try {
      localStorage.setItem(SCHEDULE_KEY, JSON.stringify(scheduledPosts.slice(0, 100)));
    } catch {
      /* ignore quota */
    }
  }, [scheduledPosts]);

  useEffect(() => {
    void getCompanyProfile()
      .then((profile) => {
        if (!profile) return;
        setBrandContext({
          productName: profile.companyName || 'Nexora',
          brandVoice: profile.voiceTone || 'Clear · Confident · Helpful',
          audience: profile.audience || 'Growth and marketing teams',
          visualLanguage: profile.writingStyle?.slice(0, 80) || 'Minimal · Clean · On-brand',
          brandConstraints: (profile.avoid || []).join(', ') || 'No invented pricing or medical claims',
        });
      })
      .catch(() => undefined);

    void Promise.all([
      getInstagramStatus().catch(() => null),
      getFacebookStatus().catch(() => null),
      fetchLinkedInConnected(),
    ]).then(([ig, fb, li]) => {
      setAccounts([
        {
          id: 'acc-li',
          platform: 'LinkedIn',
          handle: li ? 'Connected workspace' : 'Not connected',
          status: li ? 'Connected' : 'Disconnected',
          followers: '—',
          engagement: '—',
          lastSync: li ? 'Live' : 'Open LinkedIn studio',
        },
        {
          id: 'acc-ig',
          platform: 'Instagram',
          handle: ig?.account?.username ? `@${ig.account.username}` : 'Not connected',
          status: ig?.connected ? 'Connected' : 'Disconnected',
          followers: '—',
          engagement: '—',
          lastSync: ig?.connected ? 'Live' : 'Channels tab',
        },
        {
          id: 'acc-fb',
          platform: 'Meta',
          handle: fb?.account?.pageName || 'Not connected',
          status: fb?.connected ? 'Connected' : 'Disconnected',
          followers: '—',
          engagement: '—',
          lastSync: fb?.connected ? 'Live' : 'Channels tab',
        },
      ]);
    });
  }, []);

  const attachGeneratedImages = useCallback(
    async (
      variations: GeneratedVariation[],
      opts: {
        topic: string;
        brand: BrandContext;
        formPrompt?: string;
        visualImageMode?: 'per-platform' | 'shared';
        visualDirection?: string;
      }
    ) => {
      if (!variations.length) return variations;

      const sharedMode = opts.visualImageMode === 'shared';

      if (sharedMode) {
        const seedDirection =
          opts.visualDirection?.trim() ||
          variations.map((v) => v.imagePrompt).find(Boolean) ||
          '';
        const sharedPrompt = composeAdImagePrompt({
          topic: opts.topic,
          product: opts.brand.productName,
          audience: opts.brand.audience,
          aiVisualDirection: seedDirection,
          formPrompt: opts.formPrompt,
        });
        try {
          const sharedUrl = await generateImage(sharedPrompt);
          for (const v of variations) {
            v.imagePrompt = sharedPrompt;
            v.imageUrl = sharedUrl;
            v.imageUrls = undefined;
            v.carouselImagePrompts = undefined;
            v.sharedCampaignImage = true;
          }
        } catch {
          /* text-only; user can render manually */
        }
        return variations;
      }

      for (const v of variations) {
        const platform = v.platform || v.versionLabel || '';
        const isIg = isInstagramPlatform(platform);
        const carouselPrompts = buildInstagramCarouselPrompts(v.content || '', {
          topic: opts.topic,
          product: opts.brand.productName,
          audience: opts.brand.audience,
          aiVisualDirection: v.imagePrompt,
          fromModel: v.carouselImagePrompts,
        });

        if (isIg && carouselPrompts.length >= 2) {
          v.carouselImagePrompts = carouselPrompts;
          const urls: string[] = [];
          for (let c = 0; c < carouselPrompts.length; c++) {
            try {
              const url = await generateImage(carouselPrompts[c]!);
              urls.push(url);
            } catch {
              /* skip failed frame; user can Regenerate per slide */
            }
          }
          if (urls.length) {
            v.imageUrls = urls;
            v.imageUrl = urls[0];
            v.imagePrompt = v.carouselImagePrompts[0];
          }
          continue;
        }

        v.imagePrompt = composeAdImagePrompt({
          topic: opts.topic,
          product: opts.brand.productName,
          audience: opts.brand.audience,
          aiVisualDirection: v.imagePrompt,
          formPrompt: opts.formPrompt,
        });
        if (isIg && isInstagramCarouselContent(v.content || '')) {
          v.imagePrompt = v.imagePrompt.replace(
            'Aspect ratio 16:9 landscape',
            'Aspect ratio 4:5 vertical portrait'
          );
        }

        try {
          v.imageUrl = await generateImage(v.imagePrompt);
        } catch {
          /* keep text; user can Regenerate image per tab */
        }
      }

      return variations;
    },
    []
  );

  const liveGenerate: CreativeLiveGenerateFn = useCallback(async ({ category, count, customPrompt, brandContext: brand, formsState }) => {
    const social = formsState.socialForm;
    const topicFromForm = [social.coreHook, social.keyTakeaways].filter(Boolean).join('\n').trim();
    const topic = (customPrompt || topicFromForm || '').trim();
    const visualImageMode = social.visualImageMode ?? 'per-platform';
    const imageOptsBase = {
      brand,
      visualImageMode,
      visualDirection: social.visualDirection,
    };

    if (category === 'Hero Brief' || category === 'Product Render' || category === 'Brand Specimen') {
      const b = formsState.heroBriefForm;
      const visualTopic = [customPrompt, b.focalSubject, b.aesthetic].filter(Boolean).join('. ').trim();
      const platforms = resolveSocialPlatforms(social.platform || 'All platforms (multi-channel pack)');
      const formPrompt = buildHeroImagePrompt(formsState);

      const pack = await generateTopicSocialPack({
        topic: visualTopic || `${category} for ${brand.productName}`,
        product: brand.productName,
        audience: brand.audience,
        platforms,
        postCount: Math.min(platforms.length, Math.max(1, count)),
        voiceMode: 'custom',
        customTone: brand.brandVoice,
        formatHint: social.format || 'Paid social / feed post with hero visual',
      });

      const posts = pack.posts?.length ? pack.posts : [];
      if (posts.length) {
        const mapped = posts.map((post, i) =>
          mapTopicSocialToVariation(post, pack, i, {
            imagePrompt: post.imagePrompt || formPrompt,
          })
        );
        return attachGeneratedImages(mapped, {
          ...imageOptsBase,
          topic: visualTopic || topic,
          formPrompt,
        });
      }
      throw new Error('Vertex returned no posts for this visual brief. Try a clearer prompt or check /api/ai/status.');
    }

    if (category === 'Social Post' && topic) {
      const platforms = resolveSocialPlatforms(social.platform);
      const multiChannel = platforms.length > 1;

      const pack = await generateTopicSocialPack({
        topic,
        product: brand.productName,
        audience: brand.audience,
        platforms,
        postCount: multiChannel ? platforms.length : Math.max(1, count),
        voiceMode: 'custom',
        customTone: brand.brandVoice,
        formatHint: social.format,
      });

      const posts = pack.posts?.length
        ? pack.posts
        : [];

      if (posts.length) {
        const mapped = posts.map((post, i) => mapTopicSocialToVariation(post, pack, i));
        return attachGeneratedImages(mapped, { ...imageOptsBase, topic });
      }
      throw new Error('Vertex returned no posts for this topic. Try a clearer prompt or check /api/ai/status.');
    }

    const platform =
      category === 'Social Post'
        ? social.platform
        : category === 'Email Copy'
          ? 'Email'
          : 'LinkedIn';

    const ideas = await generateContentIdeas({
      product: brand.productName,
      goal: customPrompt || topic || `${category} for ${brand.audience}`,
      audience: brand.audience,
      platform,
      tone: brand.brandVoice,
      voiceMode: 'custom',
      customTone: brand.brandVoice,
    });

    const captions = ideas.captions?.length ? ideas.captions : [ideas.videoScript || 'Generated draft'];
    const prompts = ideas.imagePrompts || [];
    const list: GeneratedVariation[] = [];

    for (let i = 0; i < Math.max(1, count); i++) {
      const caption = captions[i % captions.length];
      const imagePrompt = prompts[i % Math.max(prompts.length, 1)] || social.visualDirection;
      list.push({
        id: `live-${Date.now()}-${i}`,
        versionLabel: `${category} ${i + 1}`,
        content: String(caption || '').trim(),
        imagePrompt,
      });
    }
    return list;
  }, [attachGeneratedImages]);

  const liveGenerateDraft = useCallback(async (prompt: string, platforms: string[]) => {
    const topic = prompt.trim();
    if (topic) {
      const mapped = platforms.map((p) => {
        const lower = p.toLowerCase();
        if (lower.includes('instagram')) return 'Instagram';
        if (lower.includes('facebook') || lower.includes('meta')) return 'Facebook';
        if (lower.includes('twitter') || lower === 'x') return 'X (Twitter)';
        if (lower.includes('linkedin')) return 'LinkedIn';
        return p;
      });
      const channelPlatforms =
        mapped.length > 1 ? mapped : resolveSocialPlatforms('All platforms (multi-channel pack)');

      try {
        const pack = await generateTopicSocialPack({
          topic,
          product: brandContext?.productName || 'Nexora',
          audience: brandContext?.audience || 'target buyers',
          platforms: channelPlatforms.length > 1 ? channelPlatforms : mapped,
          postCount: channelPlatforms.length > 1 ? channelPlatforms.length : 1,
          voiceMode: 'custom',
          customTone: brandContext?.brandVoice || 'professional',
        });
        if (pack.posts?.length) {
          return formatTopicSocialPackForSchedule(pack.posts, pack, mapped);
        }
      } catch (packErr) {
        const msg = packErr instanceof Error ? packErr.message : String(packErr);
        throw new Error(msg || 'Vertex topic generation failed');
      }
    }

    const primary = platforms[0] || 'LinkedIn';
    if (primary.toLowerCase().includes('linkedin')) {
      const posts = await generatePostsText(
        'ai-guided',
        { brief: prompt },
        {
          postType: 'Thought Leadership',
          tone: 'Professional',
          length: 'Medium',
          useEmojis: false,
          includeCTA: true,
          voiceMode: 'company',
        },
        1
      );
      const first = posts[0];
      if (first) {
        return [first.headline, first.content].filter(Boolean).join('\n\n');
      }
      throw new Error('Vertex returned no LinkedIn post. Check /api/ai/status and GCP billing.');
    }

    const ideas = await generateContentIdeas({
      product: brandContext?.productName || 'Nexora',
      goal: prompt,
      audience: brandContext?.audience || 'target buyers',
      platform: primary,
      tone: brandContext?.brandVoice || 'professional',
      voiceMode: 'custom',
      customTone: brandContext?.brandVoice || 'professional',
    });
    return (ideas.captions?.[0] || ideas.videoScript || prompt).trim();
  }, [brandContext]);

  const isSchedule =
    activeSubCategory === 'schedule' ||
    activeSubCategory === 'social-posts' ||
    activeSubCategory === 'manual-scheduling' ||
    activeSubCategory === 'connect' ||
    activeSubCategory === 'ai-guided-creation';

  const isLibrary =
    activeSubCategory === 'library' ||
    activeSubCategory === 'content-library' ||
    activeSubCategory === 'generated-assets';

  if (isSchedule) {
    return (
      <SocialHubView
        activeSubCategory={
          activeSubCategory === 'schedule' || activeSubCategory === 'social-posts'
            ? 'ai-guided-creation'
            : activeSubCategory
        }
        accounts={accounts}
        scheduledPosts={scheduledPosts}
        onNavigateSub={onNavigateSub}
        onSchedulePostSuccess={() => onNotify?.('Broadcast Queued', 'Post added to your schedule queue.')}
        onAddScheduledPost={(post) => setScheduledPosts((prev) => [post, ...prev])}
        onDeleteScheduledPost={(id) => setScheduledPosts((prev) => prev.filter((p) => p.id !== id))}
        onUpdateScheduledPost={(updated) =>
          setScheduledPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
        }
        isFirstRun={scheduledPosts.length === 0 && accounts.every((a) => a.status !== 'Connected')}
        liveGenerateDraft={liveGenerateDraft}
        onOpenLinkedInStudio={onOpenLinkedInStudio}
        onOpenConnections={onOpenConnections}
      />
    );
  }

  return (
    <CreativeLabView
      activeSubCategory={isLibrary ? 'generated-assets' : 'create'}
      assets={assets}
      onNavigateSub={onNavigateSub}
      onGenerateSuccess={(asset) => {
        setAssets((prev) => [asset, ...prev]);
        onNotify?.('Asset saved', `"${asset.title}" added to your content library.`);
      }}
      liveGenerate={liveGenerate}
      liveRenderImage={generateImage}
      initialBrandContext={brandContext}
    />
  );
}

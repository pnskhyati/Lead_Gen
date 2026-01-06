import { GoogleGenAI, Type, Modality, FunctionDeclaration } from "@google/genai";
import type { CampaignDetails, ChatMessage, CopilotResponse, ProductShowcase, SocialInteraction, SocialResponse, Source, ChartData, CampaignPlan } from '../types';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const contentGenerationSchema = {
  type: Type.OBJECT,
  properties: {
    captions: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "An array of 3 distinct text-based content pieces (e.g., captions, full posts) tailored for the specified social media platform."
    },
    imagePrompts: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "An array of 2 detailed text-to-image prompts for a model like Imagen. These should describe visually stunning, brand-aligned images."
    },
    videoScript: {
      type: Type.STRING,
      description: "A short video script concept (less than 100 words), including scene descriptions and dialogue/voiceover."
    }
  },
  required: ["captions", "imagePrompts", "videoScript"]
};

export const generateContentIdeas = async (details: CampaignDetails) => {
  try {
    const platformInstruction = details.platform === 'LinkedIn Post'
      ? `For the 'captions' field, generate 3 complete, professional LinkedIn posts. Each post should be well-structured with a hook, body text, relevant hashtags, and a clear call-to-action. These are full posts, not just captions.`
      : `For the 'captions' field, generate 3 concise and engaging captions suitable for ${details.platform}.`;

    const prompt = `
      You are an expert marketing content creator for Nexora, a world-leading beverage alcohol company.
      Based on the following campaign details, generate a JSON object with creative content ideas.

      Campaign Details:
      - Product: ${details.product}
      - Goal: ${details.goal}
      - Target Audience: ${details.audience}
      - Platform: ${details.platform}
      - Tone of Voice: ${details.tone}

      **Content Requirements:**
      - ${platformInstruction}
      - For 'imagePrompts', provide 2 detailed prompts for an image generation AI.
      - For 'videoScript', write a brief script concept.

      Generate the response in a valid JSON format only, adhering to the provided schema.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: contentGenerationSchema,
      },
    });

    const jsonText = response.text.trim();
    return JSON.parse(jsonText);
  } catch (error) {
    console.error("Error generating content:", error);
    throw new Error("Failed to generate content from AI. Please check your prompt and API key.");
  }
};

export const generateImage = async (prompt: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            text: prompt,
          },
        ],
      },
      config: {
          responseModalities: [Modality.IMAGE],
      },
    });

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        const base64ImageBytes: string = part.inlineData.data;
        return `data:image/png;base64,${base64ImageBytes}`;
      }
    }
    
    throw new Error("No image data found in the response.");

  } catch (error) {
    console.error("Error generating image:", error);
    throw new Error("Failed to generate image from AI.");
  }
};

const getBase64DataFromDataUrl = (dataUrl: string): string => {
    const parts = dataUrl.split(',');
    if (parts.length !== 2 || !parts[1]) {
        throw new Error("Invalid data URL for base64 extraction");
    }
    return parts[1];
};

export const generatePromoVideo = async (textPrompt: string, imagePrompt: string): Promise<string> => {
  try {
    // Step 1: Generate the starting image
    const imageUrl = await generateImage(imagePrompt);
    const base64ImageData = getBase64DataFromDataUrl(imageUrl);

    // Step 2: Call the video generation API
    let operation = await ai.models.generateVideos({
      model: 'veo-3.1-fast-generate-preview',
      prompt: textPrompt,
      image: {
        imageBytes: base64ImageData,
        mimeType: 'image/png',
      },
      config: {
        numberOfVideos: 1,
        resolution: '720p',
        aspectRatio: '16:9',
      },
    });

    // Step 3: Poll for completion
    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 10000));
      operation = await ai.operations.getVideosOperation({ operation: operation });
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!downloadLink) {
      throw new Error('Video generation completed but no download link was found.');
    }

    // Step 4: Fetch video data and create a Blob URL
    const videoResponse = await fetch(`${downloadLink}&key=${API_KEY}`);
    if (!videoResponse.ok) {
        const errorBody = await videoResponse.text();
        throw new Error(`Failed to download video file: ${videoResponse.statusText}. Details: ${errorBody}`);
    }
    const videoBlob = await videoResponse.blob();
    return URL.createObjectURL(videoBlob);
  } catch (error) {
    console.error('Error generating promo video:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred during video generation.';
    throw new Error(errorMessage);
  }
};

const displayChartFunctionDeclaration: FunctionDeclaration = {
    name: 'displayChart',
    description: 'Displays a bar chart for visualizing data. Use this when the user asks for a comparison, trend, or data breakdown.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            title: {
                type: Type.STRING,
                description: 'The title of the chart.'
            },
            data: {
                type: Type.ARRAY,
                description: 'An array of data points for the chart.',
                items: {
                    type: Type.OBJECT,
                    properties: {
                        name: {
                            type: Type.STRING,
                            description: 'The label for the data point (e.g., a brand name, a month).'
                        },
                        value: {
                            type: Type.NUMBER,
                            description: 'The numerical value for the data point.'
                        }
                    },
                    required: ['name', 'value']
                }
            }
        },
        required: ['title', 'data']
    }
};

export const chatWithCopilot = async (history: Omit<ChatMessage, 'sources' | 'chartData'>[], newMessage: string): Promise<CopilotResponse> => {
  try {
    const model = 'gemini-2.5-flash';
    const systemInstruction = `You are "Catalyst AI," an elite marketing intelligence assistant for Nexora. Your purpose is to deliver precise, data-driven insights with sophistication and clarity.
- Your answers must be based on publicly available information about Nexora and its brands.
- Use the provided search tool to find the most up-to-date and accurate information. When you use information from a search result, you must cite the source.
- Crucially, for any user request that involves a data comparison (like comparing brands, sales, or market share), you MUST perform BOTH of the following actions in the SAME response:
    1. Call the 'displayChart' tool with the relevant data to generate a visual chart.
    2. Provide a detailed text analysis in the text part of your response. This text is non-optional and must accompany the chart.
- The text analysis must be structured as follows, using Markdown for formatting:
    - **[Brand Name 1]**: A section with a bolded heading for the first brand.
        - Provide bulleted points with key data (e.g., sales volume, market share, revenue). At the end of each bullet point, you MUST cite the source from your search results.
    - **[Brand Name 2]**: A section with a bolded heading for the second brand.
        - Provide bulleted points with key data, citing the source at the end of each point.
    - **Summary Comparison**: A section with a bolded heading.
        - Provide bulleted points summarizing the key differences and direct comparisons between the brands.
    - **Important Caveats**: A section with a bolded heading.
        - Provide bulleted points explaining any limitations of the data (e.g., data source, timeframe, what 'market share' refers to).
- This structured analysis is mandatory for all comparison requests.
- If real-time, precise data is not available from your search, generate plausible, illustrative sample data for the chart and state that the text analysis is based on illustrative data.`;
    
    const contents = history.map(msg => ({
        role: msg.role,
        parts: [{ text: msg.text }]
    }));
    contents.push({ role: 'user', parts: [{ text: newMessage }] });
    
    const response = await ai.models.generateContent({
        model,
        contents,
        config: {
            systemInstruction,
            tools: [{
              googleSearch: {},
            }, {
              functionDeclarations: [displayChartFunctionDeclaration]
            }],
        }
    });
    
    // FIX: Explicitly find the text part from the response, as `response.text` can be empty when a function call is present.
    const textPart = response.candidates?.[0]?.content?.parts.find(part => part.text);
    let textReply = textPart?.text || '';
    let chartData: ChartData | undefined = undefined;

    const functionCalls = response.functionCalls;
    if (functionCalls) {
        const call = functionCalls[0];
        if (call.name === 'displayChart') {
            chartData = call.args as unknown as ChartData;
            // Fallback text if the model *only* returns a chart function call, which shouldn't happen with the new prompt.
            if (!textReply) {
              textReply = `As requested, here is a chart visualizing: ${chartData.title}`;
            }
        }
    }
    
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const sources: Source[] = groundingChunks
      .map((chunk: any) => chunk.web)
      .filter((web: any) => web && web.uri && web.title)
      .map((web: any) => ({
        uri: web.uri,
        title: web.title,
      }));

    return { textReply, sources, chartData };
  } catch (error) {
    console.error("Error chatting with Copilot:", error);
    throw new Error("Failed to get response from AI Copilot.");
  }
};


export const chatWithBridalAssistant = async (history: Omit<ChatMessage, 'sources' | 'chartData'>[], newMessage: string): Promise<string> => {
  try {
    const model = 'gemini-2.5-flash';
    const systemInstruction = `You are "AURA," a sophisticated and elegant AI bridal assistant. Your purpose is to provide comprehensive, supportive, and inspiring guidance for planning a wedding. You are calm, organized, and have exquisite taste.

- **Tone:** Empathetic, celebratory, and professional. Use encouraging and positive language.
- **Knowledge Base:** You are an expert in all aspects of wedding planning, including but not limited to:
    - Timelines and checklists
    - Budgeting advice
    - Venue selection (styles, capacity, questions to ask)
    - Vendor recommendations (photographers, florists, caterers, etc.)
    - Wedding attire (dresses, suits, styles, designers)
    - Etiquette (invitations, seating charts, thank-you notes)
    - Honeymoon ideas
    - Modern trends and classic traditions
- **Interaction Style:**
    - When asked for ideas, provide creative and beautiful suggestions.
    - When asked for advice, be practical and reassuring.
    - Break down complex topics into simple, manageable steps.
    - Use Markdown for formatting, such as lists and bold text, to make your answers clear and easy to read.
- **Persona:** You are not just a database; you are a partner in the planning process. Address the user as if you are their personal assistant on this exciting journey.`;
    
    const contents = history.map(msg => ({
        role: msg.role,
        parts: [{ text: msg.text }]
    }));
    contents.push({ role: 'user', parts: [{ text: newMessage }] });
    
    const response = await ai.models.generateContent({
        model,
        contents,
        config: {
            systemInstruction,
        }
    });
    
    return response.text;
  } catch (error) {
    console.error("Error chatting with Bridal Assistant:", error);
    throw new Error("Failed to get response from Bridal Assistant.");
  }
};


const socialReplySchema = {
    type: Type.OBJECT,
    properties: {
        suggestedReply: {
            type: Type.STRING,
            description: "A brand-aligned, engaging, and empathetic reply to the customer's comment or message."
        },
        productRecommendation: {
            type: Type.OBJECT,
            properties: {
                name: {
                    type: Type.STRING,
                    description: "The name of a specific Nexora product to recommend."
                },
                reasoning: {
                    type: Type.STRING,
                    description: "A brief, compelling reason why this product is a good recommendation based on the customer's comment."
                },
                productImagePrompt: {
                    type: Type.STRING,
                    description: "A detailed text-to-image prompt to generate a visually appealing image of the recommended product. For example: 'A studio shot of a Johnnie Walker Black Label bottle, condensation dripping down the side, with a lowball glass of whisky on the rocks next to it, against a dark, moody background.'"
                },
                recipes: {
                    type: Type.ARRAY,
                    description: "An array of 3 simple cocktail recipes that can be made with the recommended product.",
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            name: {
                                type: Type.STRING,
                                description: "The name of the cocktail."
                            },
                            ingredients: {
                                type: Type.ARRAY,
                                items: { type: Type.STRING },
                                description: "A list of ingredients for the cocktail."
                            }
                        },
                        required: ['name', 'ingredients']
                    }
                }
            },
            required: ['name', 'reasoning', 'productImagePrompt', 'recipes']
        }
    },
    required: ['suggestedReply', 'productRecommendation']
};


export const generateSocialReply = async (details: SocialInteraction): Promise<SocialResponse> => {
    try {
        const prompt = `
            You are a sharp and witty Social Media Manager for Nexora. Your goal is to turn customer interactions into sales opportunities through conversational commerce.

            A customer has left the following comment on ${details.platform}:
            """
            ${details.customerComment}
            """

            **Your Task:**
            1.  Analyze the sentiment and intent of the comment.
            2.  Craft a personalized, engaging, and brand-appropriate reply. The tone should be helpful and friendly.
            3.  Suggest a relevant Nexora product that matches the context of their comment.
            4.  Provide a short reasoning for your product choice.
            5.  Create a detailed, visually rich text-to-image prompt for the recommended product.
            6.  Provide 3 simple and appealing cocktail recipes that can be made using the recommended product. List the ingredients for each.

            Generate the response in a valid JSON format only, adhering to the provided schema.
        `;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: socialReplySchema,
            },
        });

        const jsonText = response.text.trim();
        return JSON.parse(jsonText);

    } catch (error) {
        console.error("Error generating social reply:", error);
        throw new Error("Failed to generate social reply from AI.");
    }
};

const productShowcaseSchema = {
  type: Type.OBJECT,
  properties: {
    description: {
      type: Type.STRING,
      description: "A brief, evocative, and premium marketing description of the product (around 20-30 words)."
    },
    imagePrompt: {
      type: Type.STRING,
      description: "A detailed text-to-image prompt to generate a visually stunning, premium studio shot of the product bottle. The style should be dark, moody, and sophisticated, with dramatic lighting, possibly on a reflective surface, similar to a high-end advertisement."
    }
  },
  required: ["description", "imagePrompt"]
};

export const generateProductShowcase = async (productName: string): Promise<ProductShowcase> => {
  try {
    const prompt = `
      You are a creative director for Nexora.
      For the product "${productName}", generate a JSON object containing a brief marketing description and a detailed image prompt for an ad visual.
      - The description should be short, premium, and enticing.
      - The image prompt should describe a photo in the style of a luxury beverage ad: dark, atmospheric, and focused on the bottle.

      Generate the response in a valid JSON format only, adhering to the provided schema.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: productShowcaseSchema,
      },
    });

    const jsonText = response.text.trim();
    return JSON.parse(jsonText);
  } catch (error)
 {
    console.error(`Error generating product showcase for ${productName}:`, error);
    throw new Error("Failed to generate product showcase from AI.");
  }
};

const campaignPlanSchema = {
  type: Type.OBJECT,
  properties: {
    campaignTitle: { type: Type.STRING },
    slogan: { type: Type.STRING },
    personas: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          description: { type: Type.STRING },
          motivations: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["name", "description", "motivations"]
      }
    },
    messagingPillars: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          pillar: { type: Type.STRING },
          description: { type: Type.STRING }
        },
        required: ["pillar", "description"]
      }
    },
    rolloutPlan: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          phase: { type: Type.STRING },
          duration: { type: Type.STRING },
          objective: { type: Type.STRING },
          platforms: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                platform: { type: Type.STRING },
                contentIdeas: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ["platform", "contentIdeas"]
            }
          }
        },
        required: ["phase", "duration", "objective", "platforms"]
      }
    },
    kpis: {
      type: Type.ARRAY,
      items: { type: Type.STRING }
    }
  },
  required: ["campaignTitle", "slogan", "personas", "messagingPillars", "rolloutPlan", "kpis"]
};

export const generateCampaignPlan = async (brief: string): Promise<CampaignPlan> => {
    try {
        const prompt = `
            You are a world-class marketing strategist for Nexora. Based on the following high-level campaign brief, generate a comprehensive, multi-platform digital marketing campaign plan.

            **Campaign Brief:**
            "${brief}"

            **Your Task:**
            Flesh this out into a full campaign strategy. The plan should be creative, strategic, and actionable.

            **Output Requirements (adhere to this JSON schema exactly):**
            - **campaignTitle**: An exciting, catchy name for the campaign.
            - **slogan**: A memorable tagline.
            - **personas**: An array of 2-3 detailed target audience personas, including their description and key motivations.
            - **messagingPillars**: An array of 3 core messages or themes the campaign will focus on.
            - **rolloutPlan**: A 3-phase plan (e.g., Teaser, Launch, Engagement). For each phase, specify the duration, objective, and a list of platforms (like Instagram, TikTok) with specific content ideas for each.
            - **kpis**: A list of 5-6 key performance indicators to measure the campaign's success.

            Generate the response in a valid JSON format only.
        `;
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: campaignPlanSchema,
            },
        });
        const jsonText = response.text.trim();
        return JSON.parse(jsonText);
    } catch (error) {
        console.error("Error generating campaign plan:", error);
        throw new Error("Failed to generate campaign plan from AI.");
    }
};
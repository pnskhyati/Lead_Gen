export const BRAND_PRODUCTS_BY_CATEGORY = [
  {
    category: "Whisky",
    products: [
      "Johnnie Walker", "Buchanan’s", "J&B", "Bell’s", "Black & White", "The Singleton", "Talisker", "Lagavulin", "Oban", "Cardhu", "Mortlach", "Royal Lochnagar", "White Horse", "Haig Club", "Windsor", "Grand Old Parr", "Bulleit Bourbon",
    ],
  },
  {
    category: "Vodka",
    products: ["Smirnoff", "Cîroc", "Ketel One", "Eristoff"],
  },
  {
    category: "Gin",
    products: ["Tanqueray", "Gordon’s", "Jinzu", "Booth’s"],
  },
  {
    category: "Rum",
    products: ["Captain Morgan", "McDowell’s No. 1 Celebration Rum"],
  },
  {
    category: "Tequila",
    products: ["Don Julio", "Casamigos", "DeLeón"],
  },
  {
    category: "Liqueur & Cream",
    products: ["Baileys", "Pimm’s", "Sheridan’s"],
  },
  {
    category: "Beer & Other Beverages",
    products: ["Guinness", "Hop House 13", "Tusker", "Senator", "Harp Lager"],
  },
  {
    category: "🇮🇳 Indian Portfolio",
    products: [
      "McDowell’s No. 1 Whisky", "Royal Challenge", "Signature Premier Whisky", "Antiquity Blue", "Bagpiper", "Director’s Special", "Haywards Fine Whisky", "Old Tavern", "White Mischief Vodka", "Romanov Vodka", "Silk Route Gin", "VAT 69", "Black Dog",
    ],
  },
];

export const BRAND_PRODUCTS = BRAND_PRODUCTS_BY_CATEGORY.flatMap(c => c.products);

export const CAMPAIGN_GOALS = [
  "Increase brand awareness",
  "Drive sales for a new product",
  "Promote a seasonal cocktail",
  "Engage with a younger audience",
  "Highlight product quality and heritage",
];

export const PLATFORMS = [
  "Instagram Post",
  "Instagram Story",
  "TikTok Video",
  "Facebook Ad",
  "YouTube Short",
  "LinkedIn Post",
];

export const SOCIAL_PLATFORMS = [
  "Instagram Comment",
  "Facebook Comment",
  "TikTok Comment",
  "Instagram DM",
  "Facebook Messenger",
];

export const TONES_OF_VOICE = [
  "Sophisticated & Premium",
  "Playful & Energetic",
  "Witty & Humorous",
  "Inspirational & Aspirational",
  "Authentic & Down-to-earth",
];

export const AUDIENCE_SUGGESTIONS: Record<string, string> = {
  "Instagram Post": 'Young professionals, 25-35, living in urban areas, interested in premium lifestyle, cocktails, and social events.',
  "Instagram Story": 'Gen Z and younger millennials, 21-30, who enjoy interactive content like polls and quizzes, and behind-the-scenes footage.',
  "TikTok Video": 'Gen Z, 21-25, who follow viral trends, enjoy humor, and value authentic, short-form video content.',
  "Facebook Ad": 'Adults aged 30-55, interested in quality spirits, home entertaining, and brand heritage stories.',
  "YouTube Short": 'A broad audience interested in quick cocktail tutorials, product reviews, and entertaining brand-related content.',
  "LinkedIn Post": 'Industry professionals, corporate partners, and employees. Focus on brand achievements, corporate responsibility, and premium B2B offerings.',
};
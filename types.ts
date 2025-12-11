export interface Paper {
  id: string; // ArXiv ID usually, e.g., "2308.xxxxx"
  title: string;
  authors: string[];
  year: string;
  abstract_en: string;
  abstract_zh: string;
  tldr: string; // One sentence summary
  tags: string[];
  image_prompt?: string; // For generating a placeholder or fetching an image
}

export interface RecommendationContext {
  likedPapers: string[]; // List of titles or IDs user liked
  dislikedPapers: string[]; // List of titles user disliked
  currentFocus: string; // e.g. "AI Agents", "Multi-Agent Systems"
}

export enum SwipeDirection {
  LEFT = 'left',
  RIGHT = 'right'
}
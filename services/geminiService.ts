import { GoogleGenAI } from "@google/genai";
import { Paper, RecommendationContext } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Internal interface for raw data from ArXiv
interface RawArxivPaper {
  id: string;
  title: string;
  authors: string[];
  published: string;
  summary: string;
}

/**
 * Helper: Extract potential keywords from a title (Simple heuristic)
 * In a real app, Gemini could do this, but regex is faster for latency.
 */
function extractKeywords(titles: string[]): string {
  if (titles.length === 0) return "";
  
  // Combine last 3 liked titles
  const recentTitles = titles.slice(-3).join(" ");
  
  // Remove common stop words and keep interesting technical terms
  // This is a naive extraction but works for a demo
  const stopWords = ["the", "a", "an", "of", "for", "in", "on", "with", "to", "at", "by", "is", "are", "and", "or"];
  const words = recentTitles.toLowerCase().split(/[\s\W]+/);
  
  const keywords = words.filter(w => w.length > 4 && !stopWords.includes(w));
  
  // Return top 3 unique keywords joined by OR
  const uniqueKeywords = [...new Set(keywords)].slice(0, 3);
  
  if (uniqueKeywords.length === 0) return "";
  return uniqueKeywords.map(k => `all:${k}`).join(" OR ");
}

/**
 * Step 1: Fetch raw XML from ArXiv API and parse it
 */
async function fetchFromArxiv(startIndex: number, context: RecommendationContext): Promise<RawArxivPaper[]> {
  const baseUrl = "https://export.arxiv.org/api/query";
  
  // HYBRID ALGORITHM:
  // 50% chance: Fetch "Latest" papers (News) - Maintains the 'startIndex' pagination
  // 50% chance: Fetch "Relevant" papers based on likes (Discovery) - If user has likes
  
  let query = "";
  let sortBy = "submittedDate";
  let finalStartIndex = startIndex;

  const hasLikes = context.likedPapers.length > 0;
  // Use relevance strategy if we have likes and (random chance or it's the very first load to mix things up)
  const useRelevanceStrategy = hasLikes && Math.random() > 0.5;

  if (useRelevanceStrategy) {
    // Strategy B: Interest-based (Time independent)
    const keywords = extractKeywords(context.likedPapers);
    // Combine generic agent query with specific keywords
    query = `(all:"autonomous agent" OR all:"large language model") AND (${keywords})`;
    sortBy = "relevance"; // ArXiv returns most relevant first, ignoring date
    // For relevance search, we still paginate, but maybe we want to jitter the start to avoid seeing the same "top 1" forever
    // Let's use a smaller offset multiplier for relevance to go deeper
    finalStartIndex = (startIndex % 50); // Keep relevance search within top 50 matches for now
  } else {
    // Strategy A: Time-based (News)
    // "all" searches title, abstract, authors, etc.
    query = 'all:"autonomous agent" OR all:"large language model" OR all:"multi-agent"';
    sortBy = "submittedDate";
  }

  const encodedQuery = encodeURIComponent(query);
  
  // Note: max_results=5 to keep it fast
  const targetUrl = `${baseUrl}?search_query=${encodedQuery}&start=${finalStartIndex}&max_results=5&sortBy=${sortBy}&sortOrder=descending`;

  // Proxy logic
  const proxies = [
    (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`
  ];

  let lastError: any;

  for (const createProxyUrl of proxies) {
    try {
      const url = createProxyUrl(targetUrl);
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }
      
      const str = await response.text();

      if (!str.includes("<feed") && !str.includes("<entry")) {
        throw new Error("Response is not valid ArXiv XML");
      }
      
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(str, "text/xml");
      const entries = xmlDoc.getElementsByTagName("entry");
      
      const papers: RawArxivPaper[] = [];
      
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        
        const idUrl = entry.getElementsByTagName("id")[0]?.textContent || "";
        const idParts = idUrl.split("/abs/");
        const rawId = idParts.length > 1 ? idParts[1] : idUrl;
        const id = rawId.split("v")[0];
        
        const title = entry.getElementsByTagName("title")[0]?.textContent?.replace(/\n/g, " ").trim() || "";
        const summary = entry.getElementsByTagName("summary")[0]?.textContent?.replace(/\n/g, " ").trim() || "";
        const published = entry.getElementsByTagName("published")[0]?.textContent?.split("T")[0] || "";
        
        const authorTags = entry.getElementsByTagName("author");
        const authors: string[] = [];
        for (let j = 0; j < authorTags.length; j++) {
          authors.push(authorTags[j].getElementsByTagName("name")[0]?.textContent || "");
        }

        papers.push({ id, title, authors, published, summary });
      }
      
      return papers;

    } catch (e) {
      console.warn("Proxy attempt failed:", e);
      lastError = e;
    }
  }

  console.error("All ArXiv proxies failed.", lastError);
  return [];
}

/**
 * Step 2: Use Gemini to process the raw papers (Translate & Tag)
 */
async function enrichPapersWithGemini(rawPapers: RawArxivPaper[]): Promise<Paper[]> {
  if (rawPapers.length === 0) return [];

  // Construct a prompt that includes the raw data
  const minimalData = rawPapers.map(p => ({ id: p.id, title: p.title, summary: p.summary }));

  const prompt = `
    You are an expert academic translator for AI researchers.
    I will provide a list of papers (Title, Abstract). 
    
    Your Task for EACH paper:
    1. Translate the abstract into professional, fluent Chinese (Mainland China academic style).
    2. Write a "TL;DR" (Too Long; Didn't Read) - one punchy English sentence summarizing the core innovation.
    3. Generate 3 short tags (e.g., "LLM", "RL", "Vision", "Planning").

    Input Data (JSON):
    ${JSON.stringify(minimalData)}

    Output Requirement:
    Return a pure JSON Array. Do not use Markdown formatting.
    Structure:
    [
      {
        "id": "match_input_id",
        "abstract_zh": "中文翻译...",
        "tldr": "English summary...",
        "tags": ["Tag1", "Tag2", "Tag3"]
      }
    ]
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });

    const jsonText = response.text || "[]";
    let enrichedData: any[] = [];
    try {
        enrichedData = JSON.parse(jsonText);
    } catch (e) {
        console.warn("Gemini JSON parse failed, returning raw papers", e);
    }
    
    const mergedPapers: Paper[] = rawPapers.map(raw => {
      const enriched = enrichedData.find((e: any) => e.id === raw.id) || {};
      return {
        id: raw.id,
        title: raw.title,
        authors: raw.authors,
        year: raw.published,
        abstract_en: raw.summary,
        abstract_zh: enriched.abstract_zh || "翻译生成中... (Translating...)",
        tldr: enriched.tldr || raw.title, 
        tags: enriched.tags || ["New Paper"],
      };
    });

    return mergedPapers;

  } catch (e) {
    console.error("Gemini Enrichment Error:", e);
    return rawPapers.map(raw => ({
      id: raw.id,
      title: raw.title,
      authors: raw.authors,
      year: raw.published,
      abstract_en: raw.summary,
      abstract_zh: "暂无翻译 (AI服务繁忙)",
      tldr: "New ArXiv Paper",
      tags: ["ArXiv"],
    }));
  }
}

// Main Export
export const fetchRecommendations = async (context: RecommendationContext, startIndex: number = 0): Promise<Paper[]> => {
  // 1. Get raw real data with hybrid strategy
  const rawPapers = await fetchFromArxiv(startIndex, context);
  
  // 2. Enhance with AI
  return await enrichPapersWithGemini(rawPapers);
};
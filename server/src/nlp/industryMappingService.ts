import type { IndustryMapping, IndustryQueryResult } from '../types.js';

const SCORE_EXACT_KEYWORD = 10;
const SCORE_EXACT_SYNONYM = 9;
const SCORE_STOCK_CODE = 8;
const SCORE_STOCK_NAME = 8;
const SCORE_OVERSEAS_CODE = 6;
const SCORE_OVERSEAS_NAME = 6;
const SCORE_PARTIAL = 3;

function matchIndustry(keyword: string, industry: IndustryMapping): { score: number; terms: string[] } {
  const kw = keyword.trim().toLowerCase();
  if (!kw) return { score: 0, terms: [] };

  let score = 0;
  const terms: string[] = [];

  for (const k of industry.keywords) {
    if (k.toLowerCase() === kw) {
      score += SCORE_EXACT_KEYWORD;
      terms.push(k);
    }
  }

  for (const s of industry.synonyms) {
    if (s.toLowerCase() === kw) {
      score += SCORE_EXACT_SYNONYM;
      terms.push(s);
    }
  }

  for (const stock of industry.stocks) {
    if (stock.code.toLowerCase() === kw || stock.name.toLowerCase() === kw) {
      score += SCORE_STOCK_CODE;
      terms.push(stock.name);
    } else if (stock.shortName && stock.shortName.toLowerCase() === kw) {
      score += SCORE_STOCK_NAME;
      terms.push(stock.shortName);
    } else if (stock.aliases) {
      for (const alias of stock.aliases) {
        if (alias.toLowerCase() === kw) {
          score += SCORE_STOCK_NAME;
          terms.push(alias);
        }
      }
    }
  }

  for (const overseas of industry.overseasMappings) {
    if (overseas.code.toLowerCase() === kw) {
      score += SCORE_OVERSEAS_CODE;
      terms.push(overseas.code);
    } else if (overseas.name.toLowerCase() === kw) {
      score += SCORE_OVERSEAS_NAME;
      terms.push(overseas.name);
    }
  }

  if (score === 0) {
    for (const k of industry.keywords) {
      if (k.toLowerCase().includes(kw) || kw.includes(k.toLowerCase())) {
        score += SCORE_PARTIAL;
        terms.push(k);
        break;
      }
    }
    if (score === 0) {
      for (const s of industry.synonyms) {
        if (s.toLowerCase().includes(kw) || kw.includes(s.toLowerCase())) {
          score += SCORE_PARTIAL;
          terms.push(s);
          break;
        }
      }
    }
    if (score === 0) {
      if (industry.name.toLowerCase().includes(kw) || kw.includes(industry.name.toLowerCase())) {
        score += SCORE_PARTIAL;
        terms.push(industry.name);
      }
    }
  }

  return { score, terms: [...new Set(terms)] };
}

export function queryIndustriesByKeywords(keywords: string[], allIndustries: IndustryMapping[]): IndustryQueryResult[] {
  const resultMap = new Map<string, IndustryQueryResult>();

  for (const kw of keywords) {
    for (const industry of allIndustries) {
      const { score, terms } = matchIndustry(kw, industry);
      if (score > 0) {
        const existing = resultMap.get(industry.id);
        if (existing) {
          existing.relevanceScore += score;
          for (const t of terms) {
            if (!existing.matchedTerms.includes(t)) existing.matchedTerms.push(t);
          }
        } else {
          resultMap.set(industry.id, {
            industry,
            matchedTerms: [...terms],
            relevanceScore: score,
          });
        }
      }
    }
  }

  return Array.from(resultMap.values()).sort((a, b) => b.relevanceScore - a.relevanceScore);
}

export function queryIndustriesByText(text: string, allIndustries: IndustryMapping[]): IndustryQueryResult[] {
  const keywords = text
    .split(/[\s,，、;；]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return queryIndustriesByKeywords(keywords, allIndustries);
}

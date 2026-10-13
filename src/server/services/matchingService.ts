import { Product, MatchingReviewItem } from '../../types/index.js';
import { dbAll, dbRun } from '../db/database.js';
import crypto from 'crypto';

export interface MatchResult {
  matchType: 'exact' | 'probable' | 'alternative' | 'unmatched';
  confidence: number;
  matchedProduct: Product | null;
  reasons: string[];
}

export function normalizeText(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ي/g, 'ي')
    .replace(/[\(\)\[\]\{\}\-_,\.\+]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extracts storage/memory capacities like 128gb, 256gb, 512gb, 1tb, 8gb, 16gb.
 */
export function extractCapacity(text: string): string | null {
  const match = text.toLowerCase().match(/\b(64\s*gb|128\s*gb|256\s*gb|512\s*gb|1\s*tb|2\s*tb|8\s*gb|16\s*gb|32\s*gb)\b/);
  return match ? match[1].replace(/\s+/g, '') : null;
}

/**
 * Deterministic product matching.
 * Prioritizes brand and model agreement.
 * Strictly prevents merging conflicting variants.
 */
export function matchCandidateToCatalog(candidateTitle: string, candidatePrice?: number | null): MatchResult {
  const normCandidate = normalizeText(candidateTitle);
  const candidateCap = extractCapacity(candidateTitle);

  const products = dbAll<any>(`
    SELECT id, name, name_ar, normalized_name, brand, model, category_id, specifications, image_url
    FROM products
  `);

  let bestMatch: Product | null = null;
  let bestScore = 0;
  let bestType: MatchResult['matchType'] = 'unmatched';
  let bestReasons: string[] = [];

  for (const p of products) {
    const normProduct = normalizeText(`${p.name} ${p.name_ar} ${p.brand || ''} ${p.model || ''}`);
    const productCap = extractCapacity(`${p.name} ${p.specifications}`);

    // If both have explicit capacity and they conflict, CANNOT be exact or probable
    const hasConflictingCapacity = candidateCap && productCap && candidateCap !== productCap;

    // Check brand match
    const brandMatches = p.brand ? normCandidate.includes(normalizeText(p.brand)) : false;

    // Check model match
    const modelMatches = p.model ? normCandidate.includes(normalizeText(p.model)) : false;

    // Word intersection score
    const candidateWords = new Set(normCandidate.split(' ').filter(w => w.length > 2));
    const productWords = new Set(normProduct.split(' ').filter(w => w.length > 2));

    let intersectionCount = 0;
    candidateWords.forEach(w => {
      if (productWords.has(w)) intersectionCount++;
    });

    const jaccard = candidateWords.size > 0 ? intersectionCount / Math.max(candidateWords.size, productWords.size) : 0;

    let score = jaccard;
    if (brandMatches) score += 0.25;
    if (modelMatches) score += 0.35;

    score = Math.min(1.0, score);

    if (hasConflictingCapacity) {
      // It's an alternative or different variant!
      if (brandMatches && modelMatches) {
        if (score > bestScore) {
          bestScore = 0.55; // Capped
          bestType = 'alternative';
          bestMatch = { ...p, specifications: JSON.parse(p.specifications || '{}') };
          bestReasons = [`تطابق في الموديل (${p.model}) واختلاف في السعة (${candidateCap} مقابل ${productCap})`];
        }
      }
      continue;
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = { ...p, specifications: JSON.parse(p.specifications || '{}') };
      if (score >= 0.75 && brandMatches && modelMatches) {
        bestType = 'exact';
        bestReasons = ['تطابق تام في الماركة والموديل والمواصفات'];
      } else if (score >= 0.45) {
        bestType = 'probable';
        bestReasons = ['تطابق محتمل في الماركة أو جزء من الاسم'];
      } else {
        bestType = 'unmatched';
        bestReasons = ['نسبة تطابق منخفضة'];
      }
    }
  }

  // If match is probable (uncertain), register for admin matching review
  if (bestType === 'probable' && bestMatch) {
    recordUncertainMatch({
      candidateTitle,
      candidatePrice: candidatePrice ?? null,
      candidateStore: null,
      candidateUrl: '',
      matchedProductId: bestMatch.id,
      matchType: bestType,
      confidence: bestScore,
      notes: bestReasons.join(', ')
    });
  }

  return {
    matchType: bestType,
    confidence: Math.round(bestScore * 100) / 100,
    matchedProduct: bestMatch,
    reasons: bestReasons
  };
}

export function recordUncertainMatch(data: {
  candidateTitle: string;
  candidatePrice: number | null;
  candidateStore: string | null;
  candidateUrl: string;
  matchedProductId: string | null;
  matchType: 'exact' | 'probable' | 'alternative' | 'unmatched';
  confidence: number;
  notes?: string;
}) {
  try {
    const id = `rev_${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();
    dbRun(`
      INSERT INTO matching_reviews (
        id, candidate_title, candidate_price, candidate_currency, candidate_store,
        candidate_url, matched_product_id, match_type, match_confidence, status, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      data.candidateTitle,
      data.candidatePrice,
      'EGP',
      data.candidateStore,
      data.candidateUrl,
      data.matchedProductId,
      data.matchType,
      data.confidence,
      'pending',
      data.notes || null,
      now
    ]);
  } catch (err) {
    console.error('[MatchingService] Error recording uncertain match:', err);
  }
}

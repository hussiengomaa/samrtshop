import { SearchResponse, Product, ProductOffer, ExternalObservation, ProviderStatusCode } from '../../types/index.js';
import { dbAll, dbRun } from '../db/database.js';
import { SerpApiProvider } from '../providers/serpapiProvider.js';
import { GeminiGroundingProvider } from '../providers/geminiGroundingProvider.js';
import { matchCandidateToCatalog, normalizeText } from './matchingService.js';
import { enrichOfferWithCalculation } from './priceCalculation.js';
import crypto from 'crypto';

const serpApiProvider = new SerpApiProvider();
const geminiProvider = new GeminiGroundingProvider();

// In-memory query cache with TTL
interface CacheEntry {
  response: SearchResponse;
  expiresAt: number;
}
const searchCache = new Map<string, CacheEntry>();

export async function executeSearch(params: {
  query: string;
  forceExternal?: boolean;
  userId?: string | null;
}): Promise<SearchResponse> {
  const startTime = Date.now();
  const rawQuery = (params.query || '').trim();

  // 1 & 2: Validate and normalize input
  if (!rawQuery || rawQuery.length > 200) {
    throw new Error('نص البحث غير صالح أو يتجاوز الحد الأقصى المسموح / Invalid query length');
  }

  const normalizedQuery = normalizeText(rawQuery);
  const cacheKey = normalizedQuery;
  const now = Date.now();

  // Check cache
  if (!params.forceExternal && searchCache.has(cacheKey)) {
    const entry = searchCache.get(cacheKey)!;
    if (entry.expiresAt > now) {
      // Record cache hit search log
      recordSearchLog({
        userId: params.userId || null,
        query: rawQuery,
        normalizedQuery,
        sourceSummary: 'hybrid',
        resultCount: entry.response.exactMatches.length + entry.response.alternativeMatches.length,
        status: 'success',
        durationMs: Date.now() - startTime,
        cacheHit: true
      });

      return {
        ...entry.response,
        fromCache: true,
        durationMs: Date.now() - startTime
      };
    } else {
      searchCache.delete(cacheKey);
    }
  }

  // 3: Search internal database
  const searchPattern = `%${normalizedQuery}%`;
  const internalProducts = dbAll<any>(`
    SELECT p.*, c.name as category_name, c.name_ar as category_name_ar
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.normalized_name LIKE ?
       OR p.name LIKE ?
       OR p.name_ar LIKE ?
       OR p.brand LIKE ?
       OR p.model LIKE ?
  `, [searchPattern, `%${rawQuery}%`, `%${rawQuery}%`, searchPattern, searchPattern]);

  // Fetch all offers for matching products
  const exactMatches: Product[] = [];
  const alternativeMatches: Product[] = [];

  for (const rawProd of internalProducts) {
    const offers = dbAll<any>(`
      SELECT o.*, s.name as store_name, s.name_ar as store_name_ar, s.website_url, s.logo_url
      FROM product_offers o
      LEFT JOIN stores s ON o.store_id = s.id
      WHERE o.product_id = ?
      ORDER BY o.product_price ASC
    `, [rawProd.id]);

    const enrichedOffers: ProductOffer[] = offers.map(off => enrichOfferWithCalculation({
      ...off,
      store: off.store_name ? {
        id: off.store_id,
        name: off.store_name,
        name_ar: off.store_name_ar || off.store_name,
        website_url: off.website_url || '',
        logo_url: off.logo_url || null,
        status: 'active',
        created_at: off.created_at,
        updated_at: off.updated_at
      } : undefined
    }));

    // Find lowest confirmed price & lowest complete total cost
    const validPrices = enrichedOffers
      .map(o => o.product_price)
      .filter((p): p is number => p !== null && p > 0);
    const lowestPrice = validPrices.length > 0 ? Math.min(...validPrices) : null;

    const completeTotals = enrichedOffers
      .filter(o => o.is_total_cost_complete && o.total_cost !== null && o.total_cost !== undefined)
      .map(o => o.total_cost as number);
    const lowestTotalCost = completeTotals.length > 0 ? Math.min(...completeTotals) : null;

    const prod: Product = {
      ...rawProd,
      specifications: JSON.parse(rawProd.specifications || '{}'),
      offers: enrichedOffers,
      lowest_price: lowestPrice,
      lowest_total_cost: lowestTotalCost,
      offers_count: enrichedOffers.length
    };

    exactMatches.push(prod);
  }

  // 4 & 5: Assess whether external discovery is needed
  const needsExternal = params.forceExternal || exactMatches.length === 0;

  const externalObservations: ExternalObservation[] = [];
  const providerStatuses: Record<string, { status: ProviderStatusCode; message?: string; count: number }> = {};

  if (needsExternal) {
    // 6: Run external providers concurrently
    const [serpResult, geminiResult] = await Promise.allSettled([
      serpApiProvider.searchShoppingOffers(rawQuery),
      geminiProvider.searchShoppingOffers(rawQuery)
    ]);

    if (serpResult.status === 'fulfilled') {
      providerStatuses['serpapi'] = {
        status: serpResult.value.status,
        message: serpResult.value.message,
        count: serpResult.value.observations.length
      };
      externalObservations.push(...serpResult.value.observations);
    } else {
      providerStatuses['serpapi'] = {
        status: 'provider_error',
        message: serpResult.reason?.message || 'Error executing SerpApi',
        count: 0
      };
    }

    if (geminiResult.status === 'fulfilled') {
      providerStatuses['gemini_grounding'] = {
        status: geminiResult.value.status,
        message: geminiResult.value.message,
        count: geminiResult.value.observations.length
      };
      externalObservations.push(...geminiResult.value.observations);
    } else {
      providerStatuses['gemini_grounding'] = {
        status: 'provider_error',
        message: geminiResult.reason?.message || 'Error executing Gemini grounding',
        count: 0
      };
    }

    // 8, 9, 10: Deduplicate & Match external observations
    const seenUrls = new Set<string>();
    const deduplicatedObs: ExternalObservation[] = [];

    for (const obs of externalObservations) {
      if (!obs.source_url || seenUrls.has(obs.source_url)) continue;
      seenUrls.add(obs.source_url);

      // Persist observation to database
      try {
        dbRun(`
          INSERT INTO external_search_observations (
            id, provider, query, title, source_url, store_name, price, currency,
            shipping_cost, availability, raw_source_reference, retrieved_at,
            verification_status, match_confidence, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          obs.id, obs.provider, obs.query, obs.title, obs.source_url, obs.store_name,
          obs.price, obs.currency, obs.shipping_cost, obs.availability,
          obs.raw_source_reference, obs.retrieved_at, obs.verification_status,
          obs.match_confidence, obs.created_at
        ]);
      } catch (e) {
        console.error('[SearchOrchestrator] Failed to persist observation:', e);
      }

      // Check match against catalog
      const match = matchCandidateToCatalog(obs.title, obs.price);
      if (match.matchType === 'exact' && match.matchedProduct) {
        // If not already in exactMatches, add
        if (!exactMatches.some(p => p.id === match.matchedProduct!.id)) {
          exactMatches.push(match.matchedProduct);
        }
      } else if (match.matchType === 'alternative' && match.matchedProduct) {
        if (!alternativeMatches.some(p => p.id === match.matchedProduct!.id) &&
            !exactMatches.some(p => p.id === match.matchedProduct!.id)) {
          alternativeMatches.push(match.matchedProduct);
        }
      }

      deduplicatedObs.push(obs);
    }

    externalObservations.length = 0;
    externalObservations.push(...deduplicatedObs);
  }

  const durationMs = Date.now() - startTime;
  const totalResults = exactMatches.length + alternativeMatches.length + externalObservations.length;

  const response: SearchResponse = {
    query: rawQuery,
    totalInternalResults: exactMatches.length + alternativeMatches.length,
    totalExternalResults: externalObservations.length,
    exactMatches,
    alternativeMatches,
    externalObservations,
    providerStatuses,
    retrievalTimestamp: new Date().toISOString(),
    durationMs,
    fromCache: false
  };

  // Cache response (TTL 60 minutes)
  const ttlMs = (Number(process.env.CACHE_TTL_MINUTES) || 60) * 60 * 1000;
  searchCache.set(cacheKey, {
    response,
    expiresAt: now + ttlMs
  });

  // 13: Persist search log
  recordSearchLog({
    userId: params.userId || null,
    query: rawQuery,
    normalizedQuery,
    sourceSummary: needsExternal ? 'hybrid' : 'internal',
    resultCount: totalResults,
    status: totalResults > 0 ? 'success' : 'empty',
    durationMs,
    cacheHit: false
  });

  return response;
}

function recordSearchLog(data: {
  userId: string | null;
  query: string;
  normalizedQuery: string;
  sourceSummary: 'internal' | 'external' | 'hybrid';
  resultCount: number;
  status: 'success' | 'empty' | 'error';
  durationMs: number;
  cacheHit: boolean;
}) {
  try {
    const id = `sl_${crypto.randomUUID().slice(0, 8)}`;
    dbRun(`
      INSERT INTO search_logs (
        id, user_id, query, normalized_query, search_source_summary,
        result_count, status, duration_ms, cache_hit, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, data.userId, data.query, data.normalizedQuery, data.sourceSummary,
      data.resultCount, data.status, data.durationMs, data.cacheHit ? 1 : 0,
      new Date().toISOString()
    ]);
  } catch (err) {
    console.error('[SearchOrchestrator] Error logging search event:', err);
  }
}

import { ExternalSearchProvider, ProviderSearchResult, ExternalSearchOptions } from './providerInterface.js';
import { ExternalObservation, ProviderHealth } from '../../types/index.js';
import { dbRun } from '../db/database.js';
import crypto from 'crypto';

export class SerpApiProvider implements ExternalSearchProvider {
  name: 'serpapi' = 'serpapi';

  private apiKey: string | undefined;
  private enabled: boolean;
  private lastSuccess: string | null = null;
  private lastFailure: string | null = null;
  private lastErrorCategory: string | null = null;
  private totalCalls = 0;
  private failedCalls = 0;

  constructor() {
    this.apiKey = process.env.SERPAPI_API_KEY;
    this.enabled = process.env.SERPAPI_ENABLED !== 'false';
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim() !== '' && this.apiKey !== 'your_serpapi_key_here');
  }

  async getHealth(): Promise<ProviderHealth> {
    const configured = this.isConfigured();
    const failureRate = this.totalCalls > 0 ? Math.round((this.failedCalls / this.totalCalls) * 100) : 0;

    return {
      provider: 'serpapi',
      configured,
      enabled: this.enabled,
      status: !configured ? 'not_configured' : !this.enabled ? 'disabled' : 'ok',
      lastSuccessfulCall: this.lastSuccess,
      lastFailure: this.lastFailure,
      errorCategory: this.lastErrorCategory,
      recentFailureRate: failureRate,
      latencyMs: 0,
      resultCount: 0,
      cacheHit: false,
      cacheTtlMinutes: Number(process.env.CACHE_TTL_MINUTES || 60),
      message: !configured
        ? 'SERPAPI_API_KEY غير مهيأ في متغيرات البيئة / SERPAPI_API_KEY is not configured in environment'
        : !this.enabled
        ? 'المزود معطل يدوياً / Provider manually disabled'
        : 'المزود جاهز ومتاح / Provider ready'
    };
  }

  async searchShoppingOffers(query: string, options: ExternalSearchOptions = {}): Promise<ProviderSearchResult> {
    const startTime = Date.now();
    const retrievedAt = new Date().toISOString();

    if (!this.enabled) {
      return {
        provider: 'serpapi',
        status: 'disabled',
        message: 'SerpApi provider is disabled',
        observations: [],
        durationMs: 0,
        retrievedAt
      };
    }

    if (!this.isConfigured()) {
      return {
        provider: 'serpapi',
        status: 'not_configured',
        message: 'مفتاح SERPAPI_API_KEY غير موجود في الخادم (يمكن إضافته في إعدادات البيئة)',
        observations: [],
        durationMs: 0,
        retrievedAt
      };
    }

    this.totalCalls++;

    try {
      const url = new URL('https://serpapi.com/search.json');
      url.searchParams.set('engine', 'google_shopping');
      url.searchParams.set('q', query);
      url.searchParams.set('gl', options.country || 'eg');
      url.searchParams.set('hl', options.language || 'ar');
      url.searchParams.set('api_key', this.apiKey!);
      url.searchParams.set('num', String(options.limit || 8));

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(url.toString(), {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' }
      });
      clearTimeout(timeoutId);

      const durationMs = Date.now() - startTime;

      if (!response.ok) {
        this.failedCalls++;
        this.lastFailure = retrievedAt;
        this.lastErrorCategory = `HTTP_${response.status}`;
        this.logEvent('search', response.status === 429 ? 'rate_limited' : 'provider_error', `HTTP ${response.status}`, durationMs, 0);

        return {
          provider: 'serpapi',
          status: response.status === 429 ? 'rate_limited' : 'provider_error',
          message: `SerpApi error: HTTP ${response.status}`,
          observations: [],
          durationMs,
          retrievedAt
        };
      }

      const json = await response.json();
      const shoppingResults = json.shopping_results || [];

      const observations: ExternalObservation[] = [];
      for (const item of shoppingResults) {
        const rawPrice = typeof item.price === 'string' ? parseFloat(item.price.replace(/[^0-9\.]/g, '')) : (typeof item.price === 'number' ? item.price : null);
        const sourceUrl = item.link || item.product_link || '';

        // Only add if source URL is present
        if (!sourceUrl) continue;

        const obs: ExternalObservation = {
          id: `obs_serp_${crypto.randomUUID().slice(0, 8)}`,
          provider: 'serpapi',
          query,
          title: item.title || query,
          source_url: sourceUrl,
          store_name: item.source || 'متجر عبر الإنترنت',
          price: rawPrice && !isNaN(rawPrice) ? rawPrice : null,
          currency: 'EGP',
          shipping_cost: item.shipping && item.shipping.includes('Free') ? 0 : null,
          availability: 'in_stock',
          raw_source_reference: item.product_id || null,
          retrieved_at: retrievedAt,
          verification_status: 'unverified',
          match_confidence: 0.8,
          created_at: retrievedAt
        };
        observations.push(obs);
      }

      this.lastSuccess = retrievedAt;
      this.logEvent('search', observations.length === 0 ? 'empty' : 'ok', null, durationMs, observations.length);

      return {
        provider: 'serpapi',
        status: observations.length === 0 ? 'empty' : 'ok',
        observations,
        durationMs,
        retrievedAt
      };
    } catch (err: any) {
      this.failedCalls++;
      this.lastFailure = retrievedAt;
      const durationMs = Date.now() - startTime;
      const isTimeout = err.name === 'AbortError';
      const status = isTimeout ? 'timeout' : 'provider_error';
      this.lastErrorCategory = isTimeout ? 'TIMEOUT' : 'NETWORK_ERROR';

      this.logEvent('search', status, err.message, durationMs, 0);

      return {
        provider: 'serpapi',
        status,
        message: isTimeout ? 'مهلة الطلب انتهت مع مزود SerpApi' : 'خطأ في الاتصال بمزود SerpApi',
        observations: [],
        durationMs,
        retrievedAt
      };
    }
  }

  private logEvent(eventType: string, status: string, errorCategory: string | null, latencyMs: number, resultCount: number) {
    try {
      dbRun(`
        INSERT INTO provider_events (id, provider, event_type, status, error_category, latency_ms, result_count, cache_hit, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        `pe_serp_${crypto.randomUUID().slice(0, 8)}`,
        'serpapi',
        eventType,
        status,
        errorCategory,
        latencyMs,
        resultCount,
        0,
        new Date().toISOString()
      ]);
    } catch (e) {
      console.error('[SerpApi] Failed to log provider event:', e);
    }
  }
}

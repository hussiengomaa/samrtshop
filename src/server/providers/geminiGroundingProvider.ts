import { ExternalSearchProvider, ProviderSearchResult, ExternalSearchOptions } from './providerInterface.js';
import { ExternalObservation, ProviderHealth } from '../../types/index.js';
import { GoogleGenAI, Type } from '@google/genai';
import { dbRun } from '../db/database.js';
import crypto from 'crypto';

export class GeminiGroundingProvider implements ExternalSearchProvider {
  name: 'gemini_grounding' = 'gemini_grounding';

  private ai: GoogleGenAI | null = null;
  private apiKey: string | undefined;
  private enabled: boolean;
  private lastSuccess: string | null = null;
  private lastFailure: string | null = null;
  private lastErrorCategory: string | null = null;
  private totalCalls = 0;
  private failedCalls = 0;

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    this.enabled = process.env.GEMINI_GROUNDING_ENABLED !== 'false';

    if (this.apiKey) {
      try {
        this.ai = new GoogleGenAI({
          apiKey: this.apiKey,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build'
            }
          }
        });
      } catch (err) {
        console.error('[GeminiGroundingProvider] Failed to instantiate GoogleGenAI:', err);
      }
    }
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim() !== '' && this.apiKey !== 'MY_GEMINI_API_KEY');
  }

  async getHealth(): Promise<ProviderHealth> {
    const configured = this.isConfigured();
    const failureRate = this.totalCalls > 0 ? Math.round((this.failedCalls / this.totalCalls) * 100) : 0;

    return {
      provider: 'gemini_grounding',
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
        ? 'GEMINI_API_KEY غير مهيأ / GEMINI_API_KEY is not configured'
        : !this.enabled
        ? 'المزود معطل يدوياً / Provider disabled'
        : 'مزود Gemini مع البحث الأرضي جاهز / Gemini Search Grounding ready'
    };
  }

  async searchShoppingOffers(query: string, _options: ExternalSearchOptions = {}): Promise<ProviderSearchResult> {
    const startTime = Date.now();
    const retrievedAt = new Date().toISOString();

    if (!this.enabled) {
      return {
        provider: 'gemini_grounding',
        status: 'disabled',
        message: 'Gemini search grounding provider is disabled',
        observations: [],
        durationMs: 0,
        retrievedAt
      };
    }

    if (!this.isConfigured() || !this.ai) {
      return {
        provider: 'gemini_grounding',
        status: 'not_configured',
        message: 'مفتاح GEMINI_API_KEY غير مهيأ في الخادم',
        observations: [],
        durationMs: 0,
        retrievedAt
      };
    }

    this.totalCalls++;

    try {
      const prompt = `أنت محرك بحث أسعار ذكي في مصر.
ابحث على الويب عن عروض وأسعار المنتج التالي في المتاجر المصرية الموثوقة حصراً مثل (Amazon Egypt, Noon Egypt, Jumia Egypt, B.Tech, 2B, Raya Shop):
المنتج المطلوب: "${query}"

المطلوب استخراجه بدقة بصيغة JSON:
قائمة بالعروض المتوفرة، لكل عرض:
- title: اسم المنتج الكامل كما هو معروض
- storeName: اسم المتجر (مثال: Amazon.eg, Noon, Jumia, B.Tech)
- price: السعر الحالي بالأرقام فقط بالجنيه المصري (مثال: 54999). إذا لم يكن معروفاً، ضع null
- sourceUrl: رابط صفحة المنتج أو المتجر الدقيق
- shippingCost: مصاريف الشحن بالأرقام إذا ذُكرت، أو null إذا لم تُذكر
- availability: حالة التوفر (in_stock, out_of_stock, unknown)

ممنوع اختراع أسعار أو متاجر. استخدم فقط ما تجده في نتائج البحث الميدانية.`;

      const response = await this.ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                storeName: { type: Type.STRING },
                price: { type: Type.NUMBER, nullable: true },
                sourceUrl: { type: Type.STRING },
                shippingCost: { type: Type.NUMBER, nullable: true },
                availability: { type: Type.STRING }
              },
              required: ['title', 'storeName', 'sourceUrl']
            }
          }
        }
      });

      const durationMs = Date.now() - startTime;
      const text = response.text?.trim() || '[]';
      let parsed: any[] = [];
      try {
        parsed = JSON.parse(text);
      } catch (parseErr) {
        console.warn('[GeminiGrounding] JSON parse error, text was:', text);
      }

      // Also extract grounding chunks if available
      const groundingChunks = (response.candidates?.[0] as any)?.groundingMetadata?.groundingChunks || [];
      const defaultUrl = groundingChunks.find((c: any) => c.web?.uri)?.web?.uri || `https://www.google.com/search?q=${encodeURIComponent(query + ' مصر')}`;

      const observations: ExternalObservation[] = [];
      for (const item of parsed) {
        if (!item.title) continue;

        const obs: ExternalObservation = {
          id: `obs_gem_${crypto.randomUUID().slice(0, 8)}`,
          provider: 'gemini_grounding',
          query,
          title: item.title,
          source_url: item.sourceUrl && item.sourceUrl.startsWith('http') ? item.sourceUrl : defaultUrl,
          store_name: item.storeName || 'متجر مصري',
          price: typeof item.price === 'number' && item.price > 0 ? item.price : null,
          currency: 'EGP',
          shipping_cost: typeof item.shippingCost === 'number' ? item.shippingCost : null,
          availability: item.availability || 'in_stock',
          raw_source_reference: 'gemini_search_grounding',
          retrieved_at: retrievedAt,
          verification_status: 'unverified',
          match_confidence: 0.85,
          created_at: retrievedAt
        };
        observations.push(obs);
      }

      this.lastSuccess = retrievedAt;
      this.logEvent('search', observations.length === 0 ? 'empty' : 'ok', null, durationMs, observations.length);

      return {
        provider: 'gemini_grounding',
        status: observations.length === 0 ? 'empty' : 'ok',
        observations,
        durationMs,
        retrievedAt
      };
    } catch (err: any) {
      this.failedCalls++;
      this.lastFailure = retrievedAt;
      const durationMs = Date.now() - startTime;
      this.lastErrorCategory = err.status || 'API_ERROR';
      this.logEvent('search', 'provider_error', err.message, durationMs, 0);

      console.error('[GeminiGroundingProvider] Error during search:', err.message || err);

      return {
        provider: 'gemini_grounding',
        status: 'provider_error',
        message: err.message || 'خطأ أثناء تنفيذ البحث المعزز مع Gemini',
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
        `pe_gem_${crypto.randomUUID().slice(0, 8)}`,
        'gemini_grounding',
        eventType,
        status,
        errorCategory,
        latencyMs,
        resultCount,
        0,
        new Date().toISOString()
      ]);
    } catch (e) {
      console.error('[GeminiGrounding] Failed to log provider event:', e);
    }
  }
}

import { ExternalObservation, ProviderHealth, ProviderStatusCode } from '../../types/index.js';

export interface ExternalSearchOptions {
  limit?: number;
  country?: string; // 'eg'
  language?: string; // 'ar'
}

export interface ProviderSearchResult {
  provider: 'serpapi' | 'gemini_grounding';
  status: ProviderStatusCode;
  message?: string;
  observations: ExternalObservation[];
  durationMs: number;
  retrievedAt: string;
}

export interface ExternalSearchProvider {
  name: 'serpapi' | 'gemini_grounding';
  searchShoppingOffers(query: string, options?: ExternalSearchOptions): Promise<ProviderSearchResult>;
  getHealth(): Promise<ProviderHealth>;
}

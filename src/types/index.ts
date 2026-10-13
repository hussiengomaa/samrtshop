export type Language = 'ar' | 'en';

export interface Category {
  id: string;
  name: string;
  name_ar: string;
  slug: string;
  parent_id: string | null;
  icon?: string;
  created_at: string;
  updated_at: string;
}

export interface Store {
  id: string;
  name: string;
  name_ar: string;
  website_url: string;
  logo_url: string | null;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export type AvailabilityStatus = 'in_stock' | 'out_of_stock' | 'unknown' | 'preorder';
export type SourceType = 'manual' | 'scraped' | 'provider_feed' | 'gemini_grounded' | 'serpapi';
export type VerificationStatus = 'verified' | 'unverified' | 'disputed' | 'stale';

export interface ProductOffer {
  id: string;
  product_id: string;
  store_id: string | null;
  store?: Store;
  store_name?: string;
  source_url: string;
  product_price: number | null;
  shipping_cost: number | null;
  discount_amount: number | null;
  additional_fees: number | null;
  currency: string | null;
  availability: AvailabilityStatus;
  source_type: SourceType;
  verification_status: VerificationStatus;
  last_checked_at: string | null;
  created_at: string;
  updated_at: string;
  // Computed fields
  total_cost?: number | null;
  is_total_cost_complete?: boolean;
}

export interface Product {
  id: string;
  name: string;
  name_ar: string;
  normalized_name: string;
  brand: string | null;
  model: string | null;
  category_id: string | null;
  category?: Category;
  specifications: Record<string, any>;
  image_url: string | null;
  created_at: string;
  updated_at: string;
  offers?: ProductOffer[];
  lowest_price?: number | null;
  lowest_total_cost?: number | null;
  offers_count?: number;
}

export interface ExternalObservation {
  id: string;
  provider: 'serpapi' | 'gemini_grounding';
  query: string;
  title: string;
  source_url: string;
  store_name: string | null;
  price: number | null;
  currency: string | null;
  shipping_cost: number | null;
  availability: string | null;
  raw_source_reference: string | null;
  retrieved_at: string;
  verification_status: 'unverified' | 'verified';
  match_confidence: number | null;
  created_at: string;
}

export interface PriceHistoryRecord {
  id: string;
  offer_id: string;
  store_name?: string;
  recorded_price: number;
  currency: string;
  recorded_at: string;
}

export interface UserProfile {
  id: string;
  name: string | null;
  email: string;
  role: 'admin' | 'user';
  created_at: string;
  updated_at: string;
}

export interface FavoriteItem {
  id: string;
  user_id: string;
  product_id: string;
  product?: Product;
  created_at: string;
}

export interface SearchLogItem {
  id: string;
  user_id: string | null;
  query: string;
  normalized_query: string;
  search_source_summary: 'internal' | 'external' | 'hybrid';
  result_count: number;
  status: 'success' | 'empty' | 'error';
  duration_ms: number | null;
  cache_hit: boolean;
  created_at: string;
}

export interface SavedSearchItem {
  id: string;
  user_id: string;
  query: string;
  normalized_query: string;
  filters: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface PriceAlertItem {
  id: string;
  user_id: string;
  product_id: string;
  product_name?: string;
  product_name_ar?: string;
  target_price: number;
  currency: string;
  status: 'active' | 'triggered' | 'paused';
  created_at: string;
  updated_at: string;
}

export type ProviderStatusCode = 'ok' | 'empty' | 'not_configured' | 'rate_limited' | 'timeout' | 'provider_error' | 'disabled';

export interface ProviderHealth {
  provider: 'serpapi' | 'gemini_grounding';
  configured: boolean;
  enabled: boolean;
  status: ProviderStatusCode;
  lastSuccessfulCall: string | null;
  lastFailure: string | null;
  errorCategory: string | null;
  recentFailureRate: number;
  latencyMs: number;
  resultCount: number;
  cacheHit: boolean;
  cacheTtlMinutes: number;
  message?: string;
}

export interface MatchingReviewItem {
  id: string;
  observation_id: string | null;
  candidate_title: string;
  candidate_price: number | null;
  candidate_currency: string | null;
  candidate_store: string | null;
  candidate_url: string;
  matched_product_id: string | null;
  matched_product_name?: string;
  match_type: 'exact' | 'probable' | 'alternative' | 'unmatched';
  match_confidence: number;
  status: 'pending' | 'approved' | 'rejected' | 'corrected';
  reviewed_by: string | null;
  reviewed_at: string | null;
  notes: string | null;
  created_at: string;
}

export interface CalculatedCost {
  productPrice: number;
  shippingCost: number | null;
  additionalFees: number | null;
  discountAmount: number;
  currency: string;
  totalCost: number | null;
  isComplete: boolean;
  isShippingKnown: boolean;
  isFeesKnown: boolean;
  reasons: string[];
}

export interface SearchResponse {
  query: string;
  totalInternalResults: number;
  totalExternalResults: number;
  exactMatches: Product[];
  alternativeMatches: Product[];
  externalObservations: ExternalObservation[];
  providerStatuses: Record<string, { status: ProviderStatusCode; message?: string; count: number }>;
  retrievalTimestamp: string;
  durationMs: number;
  fromCache: boolean;
}

export interface AssistantRecommendation {
  summary: string;
  summary_ar: string;
  recommendedProducts: Array<{
    productId: string;
    productName: string;
    productNameAr: string;
    brand: string | null;
    bestOffer: {
      storeName: string;
      price: number;
      shippingCost: number | null;
      totalCost: number | null;
      isTotalCostComplete: boolean;
      currency: string;
      sourceUrl: string;
    };
    reason: string;
    reason_ar: string;
    matchType: 'exact' | 'alternative';
    tradeOffs?: string;
    tradeOffs_ar?: string;
  }>;
  budgetNotice?: string;
  budgetNotice_ar?: string;
}

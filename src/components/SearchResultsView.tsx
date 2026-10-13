import React, { useState } from 'react';
import { useApp } from '../context/AppContext.js';
import { ProductCard } from './ProductCard.js';
import { Search, Filter, RefreshCw, AlertCircle, ExternalLink, ShieldCheck, Store, CheckCircle, Clock } from 'lucide-react';

export const SearchResultsView: React.FC = () => {
  const { searchResult, isSearching, searchQuery, setSearchQuery, setSearchResult, setIsSearching, lang, formatPrice, t } = useApp();

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedBrand, setSelectedBrand] = useState<string>('all');
  const [sortOption, setSortOption] = useState<'total_cost_asc' | 'price_asc' | 'price_desc'>('total_cost_asc');
  const [maxPriceFilter, setMaxPriceFilter] = useState<number>(100000);

  const handleRetryExternal = async () => {
    if (!searchQuery) return;
    setIsSearching(true);
    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery, forceExternal: true })
      });
      const data = await res.json();
      setSearchResult(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  };

  if (isSearching) {
    return (
      <div className="py-24 px-4 text-center max-w-xl mx-auto space-y-4">
        <div className="w-14 h-14 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto shadow-md" />
        <h3 className="text-lg font-bold text-slate-900">
          {lang === 'ar' ? '...جاري البحث في المتاجر والمصادر الخارجية' : 'Searching across Egyptian stores and external providers...'}
        </h3>
        <p className="text-xs text-slate-500">
          {t('نقوم بفحص أمازون مصر، نون، جوميا، بي تك وقاعدة البيانات الداخلية ومطابقة العروض.', 'Querying Amazon Egypt, Noon, Jumia, B.Tech, and internal catalog.')}
        </p>
      </div>
    );
  }

  if (!searchResult) {
    return (
      <div className="py-20 text-center text-slate-500">
        <Search className="w-10 h-10 mx-auto mb-2 text-slate-400" />
        <p>{t('يرجى إدخال كلمة بحث للبدء.', 'Please enter a search query to begin.')}</p>
      </div>
    );
  }

  // Filter products
  const filterAndSort = (items: typeof searchResult.exactMatches) => {
    return items
      .filter(p => {
        if (selectedCategory !== 'all' && p.category_id !== selectedCategory) return false;
        if (selectedBrand !== 'all' && p.brand !== selectedBrand) return false;
        if (p.lowest_price && p.lowest_price > maxPriceFilter) return false;
        return true;
      })
      .sort((a, b) => {
        if (sortOption === 'total_cost_asc') {
          return (a.lowest_total_cost ?? a.lowest_price ?? 999999) - (b.lowest_total_cost ?? b.lowest_price ?? 999999);
        } else if (sortOption === 'price_asc') {
          return (a.lowest_price ?? 999999) - (b.lowest_price ?? 999999);
        } else {
          return (b.lowest_price ?? 0) - (a.lowest_price ?? 0);
        }
      });
  };

  const filteredExact = filterAndSort(searchResult.exactMatches);
  const filteredAlternatives = filterAndSort(searchResult.alternativeMatches);

  // Available brands for filter
  const allBrands = Array.from(new Set([
    ...searchResult.exactMatches.map(p => p.brand).filter(Boolean),
    ...searchResult.alternativeMatches.map(p => p.brand).filter(Boolean)
  ])) as string[];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      
      {/* Top Search Bar Status */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-slate-500">{t('نتائج البحث عن:', 'Results for:')}</span>
              <span className="text-lg font-black text-slate-900">"{searchResult.query}"</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span>{filteredExact.length} {t('تطابق تام', 'exact matches')}</span>
              <span>•</span>
              <span>{filteredAlternatives.length} {t('بدائل مقترحة', 'alternatives')}</span>
              <span>•</span>
              <span>{searchResult.externalObservations.length} {t('عروض خارجية مرصودة', 'external observations')}</span>
              {searchResult.fromCache && (
                <span className="bg-sky-50 text-sky-700 text-[11px] px-2 py-0.5 rounded-full font-semibold border border-sky-200">
                  {t('نتائج مسترجعة من الذاكرة المؤقتة (Cache)', 'Cached result')}
                </span>
              )}
            </div>
          </div>

          {/* Providers Status Indicators */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {Object.entries(searchResult.providerStatuses).map(([pName, pStatus]) => (
              <div
                key={pName}
                className={`px-2.5 py-1 rounded-lg border font-semibold flex items-center gap-1.5 ${
                  pStatus.status === 'ok'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : pStatus.status === 'not_configured'
                    ? 'bg-slate-100 text-slate-600 border-slate-200'
                    : 'bg-amber-50 text-amber-800 border-amber-200'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                <span className="capitalize">{pName === 'serpapi' ? 'SerpApi' : 'Gemini Grounding'}:</span>
                <span>
                  {pStatus.status === 'ok' ? t('متصل', 'Connected') :
                   pStatus.status === 'not_configured' ? t('غير مهيأ', 'Not Configured') :
                   pStatus.status === 'empty' ? t('لا نتائج', 'Empty') : pStatus.status}
                </span>
              </div>
            ))}

            <button
              onClick={handleRetryExternal}
              className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold flex items-center gap-1.5 transition-colors shadow-xs"
              title={t('إعادة البحث في المتاجر الخارجية', 'Search external stores')}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{t('تحديث العروض', 'Refresh')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid: Filters + Results */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Filters Sidebar */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Filter className="w-4 h-4 text-teal-600" />
                {t('تصفية النتائج', 'Filter Results')}
              </h4>
              <button
                onClick={() => {
                  setSelectedCategory('all');
                  setSelectedBrand('all');
                  setMaxPriceFilter(100000);
                }}
                className="text-[11px] text-teal-700 hover:underline font-semibold"
              >
                {t('إعادة ضبط', 'Reset')}
              </button>
            </div>

            {/* Sort Dropdown */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                {t('الترتيب حسب:', 'Sort By:')}
              </label>
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-400"
              >
                <option value="total_cost_asc">{t('الأقل في التكلفة الإجمالية المؤكدة', 'Lowest Complete Total Cost')}</option>
                <option value="price_asc">{t('الأقل في سعر السلعة الصافي', 'Lowest Product Price')}</option>
                <option value="price_desc">{t('الأعلى سعراً', 'Highest Price')}</option>
              </select>
            </div>

            {/* Max Price Filter */}
            <div>
              <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1.5">
                <span>{t('أقصى سعر:', 'Max Price:')}</span>
                <span className="text-teal-700">{formatPrice(maxPriceFilter)}</span>
              </div>
              <input
                type="range"
                min="1000"
                max="100000"
                step="1000"
                value={maxPriceFilter}
                onChange={(e) => setMaxPriceFilter(Number(e.target.value))}
                className="w-full accent-teal-600"
              />
            </div>

            {/* Brand Filter */}
            {allBrands.length > 0 && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {t('الماركة التجارية:', 'Brand:')}
                </label>
                <select
                  value={selectedBrand}
                  onChange={(e) => setSelectedBrand(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-400"
                >
                  <option value="all">{t('جميع الماركات', 'All Brands')}</option>
                  {allBrands.map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Results Stream */}
        <div className="lg:col-span-3 space-y-10">
          
          {/* Exact Matches Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
                {t('التطابقات التامة والموثقة في الكاتالوج', 'Exact & Verified Catalog Matches')}
              </h3>
              <span className="text-xs text-slate-500 font-medium">
                {filteredExact.length} {t('منتج', 'products')}
              </span>
            </div>

            {filteredExact.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                {filteredExact.map(prod => (
                  <ProductCard key={prod.id} product={prod} originBadge="catalog" />
                ))}
              </div>
            ) : (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-8 text-center text-slate-500 text-sm">
                <AlertCircle className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="font-semibold text-slate-800">
                  {t('لا توجد منتجات تطابق البحث بدقة في الكاتالوج الداخلي حالياً.', 'No exact matches found in internal catalog.')}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {t('يمكنك مراجعة البدائل المقترحة أو العروض الخارجية المرصودة أدناه.', 'Please inspect suggested alternatives or live external observations below.')}
                </p>
              </div>
            )}
          </div>

          {/* Alternative Matches Section */}
          {filteredAlternatives.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-amber-600" />
                  {t('منتجات بديلة ومتشابهة (Similar & Alternative Products)', 'Alternative & Similar Products')}
                </h3>
                <span className="text-xs text-slate-500 font-medium">
                  {filteredAlternatives.length} {t('بديل', 'alternatives')}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                {filteredAlternatives.map(prod => (
                  <ProductCard key={prod.id} product={prod} originBadge="alternative" />
                ))}
              </div>
            </div>
          )}

          {/* External Observations Live Stream */}
          {searchResult.externalObservations.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Store className="w-5 h-5 text-sky-600" />
                    {t('العروض المرصودة من البحث الخارجي (External Observations)', 'External Store Observations')}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {t('تم جلبها عبر محركات البحث الميدانية مع توثيق المصدر وتاريخ الرصد.', 'Retrieved from live search providers with provenance and timestamps.')}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {searchResult.externalObservations.map(obs => (
                  <div
                    key={obs.id}
                    className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:shadow-xs transition-shadow"
                  >
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="bg-sky-50 text-sky-700 text-[10px] font-bold px-2 py-0.5 rounded border border-sky-200">
                          {obs.store_name || t('متجر مصري', 'Egyptian Store')}
                        </span>
                        <span className="text-[11px] text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(obs.retrieved_at).toLocaleTimeString(lang === 'ar' ? 'ar-EG' : 'en-US')}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-900">{obs.title}</h4>
                      <div className="text-xs text-slate-500 flex items-center gap-3">
                        <span>{t('المزود:', 'Provider:')} {obs.provider === 'serpapi' ? 'Google Shopping (SerpApi)' : 'Gemini Web Grounding'}</span>
                        <span>•</span>
                        <span>{obs.shipping_cost === null ? t('الشحن غير محدد', 'Shipping unknown') : (obs.shipping_cost === 0 ? t('شحن مجاني', 'Free shipping') : `شحن: ${obs.shipping_cost} ج.م`)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0 w-full sm:w-auto justify-between sm:justify-end">
                      <div className="text-end">
                        <span className="text-base font-black text-slate-900 block">
                          {formatPrice(obs.price)}
                        </span>
                        <span className="text-[10px] text-amber-700 font-medium">
                          {t('سعر استرشادي خارجي', 'Unverified observation')}
                        </span>
                      </div>

                      <a
                        href={obs.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-slate-900 hover:bg-teal-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-colors"
                      >
                        <span>{t('فتح الرابط', 'View Source')}</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

      </div>

    </div>
  );
};

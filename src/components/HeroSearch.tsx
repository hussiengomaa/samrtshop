import React, { useState } from 'react';
import { useApp } from '../context/AppContext.js';
import { Search, Sparkles, TrendingUp, ShieldCheck, Truck, Percent, Store } from 'lucide-react';

export const HeroSearch: React.FC<{ onCategorySelect?: (catId: string) => void }> = ({ onCategorySelect }) => {
  const { lang, setSearchQuery, setCurrentView, setIsSearching, setSearchResult, t } = useApp();
  const [localQuery, setLocalQuery] = useState('');

  const popularQueries = [
    { ar: 'ايفون 15 برو', en: 'iPhone 15 Pro' },
    { ar: 'سامسونج S24 الترا', en: 'Samsung S24 Ultra' },
    { ar: 'ماك بوك اير M2', en: 'MacBook Air M2' },
    { ar: 'غسالة توشيبا انفرتر', en: 'Toshiba Inverter Washer' },
    { ar: 'لابتوب دراسة وبرمجة', en: 'Laptop for Study & Coding' },
    { ar: 'شاشة ال جي 55 4K', en: 'LG 55 Inch 4K TV' }
  ];

  const handleSearch = async (queryText: string) => {
    const q = queryText.trim();
    if (!q) return;

    setSearchQuery(q);
    setCurrentView('search');
    setIsSearching(true);

    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, forceExternal: false })
      });
      const data = await res.json();
      setSearchResult(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(localQuery);
  };

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-slate-900 via-slate-900 to-slate-800 text-white pt-12 pb-16 px-4 sm:px-6 lg:px-8 border-b border-slate-800">
      {/* Background ambient decorative glow */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-4xl mx-auto text-center relative z-10">
        
        {/* Market Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-800/90 border border-slate-700 text-teal-400 text-xs font-semibold mb-6 shadow-sm">
          <Store className="w-3.5 h-3.5" />
          <span>{t('مقارنة حقيقية عبر المتاجر المصرية: أمازون، نون، جوميا، بي تك، 2B، راية', 'Real-time price comparison across Amazon Egypt, Noon, Jumia, B.Tech, 2B & Raya')}</span>
        </div>

        {/* Main Title */}
        <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white mb-4 leading-tight">
          {t('اعرف أرخص سعر وتكلفة الشراء الإجمالية', 'Discover The Best Price & Total Purchase Cost')}
        </h1>
        <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto mb-8 font-normal leading-relaxed">
          {t(
            'محرك ذكي يحسب لك السعر الصافي + مصاريف الشحن والخصومات الحقيقية، مع مساعد ذكاء اصطناعي يفهم ميزانيتك بالجنيه المصري بدقة.',
            'Smart engine calculating exact product prices, shipping fees, discounts, and grounded AI recommendations tailored for the Egyptian market.'
          )}
        </p>

        {/* Prominent Search Bar */}
        <form onSubmit={onSubmit} className="max-w-2xl mx-auto mb-6">
          <div className="relative flex items-center shadow-2xl rounded-2xl bg-slate-800/95 border-2 border-slate-700 focus-within:border-teal-400 focus-within:ring-4 focus-within:ring-teal-500/20 transition-all p-1.5">
            <div className="ps-4 text-slate-400">
              <Search className="w-5 h-5 text-teal-400" />
            </div>
            <input
              type="text"
              value={localQuery}
              onChange={(e) => setLocalQuery(e.target.value)}
              placeholder={t(
                'اكتب اسم المنتج أو الموديل (مثال: iPhone 15 Pro أو غسالة موفرة للكهرباء)...',
                'Enter product name, model (e.g., iPhone 15 Pro or Energy-saving washer)...'
              )}
              className="w-full bg-transparent border-0 px-4 py-3.5 text-base sm:text-lg text-white placeholder-slate-400 focus:outline-none focus:ring-0"
            />
            <button
              type="submit"
              className="bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold px-6 py-3.5 rounded-xl text-sm sm:text-base flex items-center gap-2 transition-all shadow-md active:scale-95 shrink-0"
            >
              <span>{t('قارن الآن', 'Compare')}</span>
            </button>
          </div>
        </form>

        {/* Popular searches tags */}
        <div className="flex flex-wrap items-center justify-center gap-2 max-w-3xl mx-auto">
          <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-teal-400" />
            {t('عمليات البحث الشائعة:', 'Trending Searches:')}
          </span>
          {popularQueries.map((pq, idx) => (
            <button
              key={idx}
              onClick={() => {
                const val = lang === 'ar' ? pq.ar : pq.en;
                setLocalQuery(val);
                handleSearch(val);
              }}
              className="bg-slate-800/80 hover:bg-slate-700 border border-slate-700/80 text-slate-300 hover:text-white px-3 py-1 rounded-lg text-xs font-medium transition-colors"
            >
              {lang === 'ar' ? pq.ar : pq.en}
            </button>
          ))}
        </div>

        {/* Core Value Pillars */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-12 text-start max-w-3xl mx-auto">
          <div className="bg-slate-800/60 border border-slate-700/70 p-4 rounded-xl flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center shrink-0">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white mb-0.5">{t('حساب التكلفة الإجمالية', 'Total Cost Calculation')}</h4>
              <p className="text-xs text-slate-400">{t('لا نفترض أن الشحن مجاني، بل نوضح المصاريف الفعلية بدقة.', 'Transparent calculation including shipping and extra fees.')}</p>
            </div>
          </div>

          <div className="bg-slate-800/60 border border-slate-700/70 p-4 rounded-xl flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white mb-0.5">{t('توثيق مصادر العروض', 'Source Provenance')}</h4>
              <p className="text-xs text-slate-400">{t('روابط مباشرة وتاريخ آخر فحص مع التمييز بين المؤكد وغير المؤكد.', 'Direct links with verification status and timestamps.')}</p>
            </div>
          </div>

          <div className="bg-slate-800/60 border border-slate-700/70 p-4 rounded-xl flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white mb-0.5">{t('مساعد ذكي يلتزم بميزانيتك', 'Budget-Enforced AI')}</h4>
              <p className="text-xs text-slate-400">{t('يفهم طلبك العامي ويوصي بخيارات حقيقية ضمن سقف ميزانيتك.', 'Understands Egyptian dialect and strictly respects your budget.')}</p>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
};

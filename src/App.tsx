import React, { useEffect, useState } from 'react';
import { AppProvider, useApp } from './context/AppContext.js';
import { Header } from './components/Header.js';
import { HeroSearch } from './components/HeroSearch.js';
import { ProductCard } from './components/ProductCard.js';
import { SearchResultsView } from './components/SearchResultsView.js';
import { AiAssistantView } from './components/AiAssistantView.js';
import { FavoritesView } from './components/FavoritesView.js';
import { AdminDashboard } from './components/AdminDashboard.js';
import { ProductDetailsModal } from './components/ProductDetailsModal.js';
import { AuthModal } from './components/AuthModal.js';
import { Footer } from './components/Footer.js';
import { Product, Category } from './types/index.js';
import {
  Smartphone, Laptop, Home, Tv, Watch, Utensils,
  Sparkles, CheckCircle2, ArrowRight, ArrowLeft, ShieldCheck, Truck, Scale
} from 'lucide-react';

const iconMap: Record<string, any> = {
  Smartphone,
  Laptop,
  Home,
  Tv,
  Watch,
  Utensils
};

const MainContent: React.FC = () => {
  const { currentView, setCurrentView, setSearchQuery, setIsSearching, setSearchResult, lang, t } = useApp();
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCat, setSelectedCat] = useState<string>('all');
  const [loadingProds, setLoadingProds] = useState(false);

  useEffect(() => {
    // Load categories
    fetch('/api/categories')
      .then(r => r.json())
      .then(setCategories)
      .catch(console.error);

    // Load initial catalog
    setLoadingProds(true);
    fetch('/api/products?limit=8')
      .then(r => r.json())
      .then(data => {
        setFeaturedProducts(data.products || []);
      })
      .catch(console.error)
      .finally(() => setLoadingProds(false));
  }, []);

  const handleCategoryClick = (catId: string, catName: string) => {
    setSelectedCat(catId);
    setSearchQuery(catName);
    setCurrentView('search');
    setIsSearching(true);
    fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: catName })
    })
      .then(r => r.json())
      .then(setSearchResult)
      .catch(console.error)
      .finally(() => setIsSearching(false));
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <Header />

      <main className="flex-1">
        {currentView === 'home' && (
          <div className="space-y-12">
            
            {/* Hero Search Section */}
            <HeroSearch onCategorySelect={(id) => setSelectedCat(id)} />

            {/* Categories Navigation Chips */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-slate-900">
                  {t('تصفح حسب الفئات الشائعة في مصر', 'Browse Popular Categories in Egypt')}
                </h3>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {categories.map((cat) => {
                  const Icon = cat.icon && iconMap[cat.icon] ? iconMap[cat.icon] : Smartphone;
                  const catLabel = lang === 'ar' ? cat.name_ar : cat.name;

                  return (
                    <button
                      key={cat.id}
                      onClick={() => handleCategoryClick(cat.id, catLabel)}
                      className="bg-white hover:bg-teal-50/50 hover:border-teal-300 border border-slate-200/90 rounded-2xl p-4 text-center transition-all duration-200 shadow-xs flex flex-col items-center gap-2.5 group"
                    >
                      <div className="w-10 h-10 rounded-xl bg-slate-100 group-hover:bg-teal-100/80 text-teal-700 flex items-center justify-center transition-colors">
                        <Icon className="w-5 h-5" />
                      </div>
                      <span className="text-xs font-bold text-slate-800 group-hover:text-teal-900 leading-snug">
                        {catLabel}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Featured Products from Actual Database */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg sm:text-xl font-black text-slate-900">
                    {t('أحدث المنتجات والعروض النشطة في المتاجر', 'Featured Products & Real Store Offers')}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {t('عروض مسجلة ومفحوصة عبر أمازون مصر، نون، بي تك، وراية شوب.', 'Verified listings across Amazon Egypt, Noon, B.Tech, and Raya Shop.')}
                  </p>
                </div>
              </div>

              {loadingProds ? (
                <div className="py-16 text-center">
                  <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto" />
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {featuredProducts.map((prod) => (
                    <ProductCard key={prod.id} product={prod} originBadge="catalog" />
                  ))}
                </div>
              )}
            </div>

            {/* AI Assistant Teaser Banner */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 text-white rounded-3xl p-8 sm:p-10 shadow-xl border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
                <div className="space-y-2 max-w-xl">
                  <div className="inline-flex items-center gap-1.5 bg-teal-500/20 text-teal-300 text-xs font-bold px-3 py-1 rounded-full border border-teal-500/30">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{t('المساعد الذكي الأول للتسوق في مصر', 'Egypt’s #1 Smart Shopping AI')}</span>
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-black text-white">
                    {t('محتار تشتري إيه؟ اسأل مساعد SmartShop AI', 'Not sure what to buy? Ask SmartShop AI')}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                    {t(
                      'اكتب ميزانيتك بالجنيه المصري (مثال: "عايز لابتوب للبرمجة في حدود 25000 جنيه") وسيقوم المساعد بتحليل المواصفات واختيار العروض الأنسب بدقة.',
                      'Specify your budget in EGP and requirements. Our AI assistant analyzes technical specs and finds the best value option.'
                    )}
                  </p>
                </div>

                <button
                  onClick={() => setCurrentView('assistant')}
                  className="bg-teal-500 hover:bg-teal-400 text-slate-950 font-black px-6 py-3.5 rounded-2xl text-sm flex items-center gap-2 transition-all shadow-lg active:scale-95 shrink-0"
                >
                  <span>{t('بدء المحادثة مع المساعد', 'Start AI Shopping Assistant')}</span>
                  {lang === 'ar' ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* How Platform Works Transparency Section */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
              <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-xs">
                <h3 className="text-lg font-black text-slate-900 text-center mb-8">
                  {t('كيف تضمن SmartShop AI شفافية ونزاهة المقارنة؟', 'How SmartShop AI Ensures Full Pricing Integrity')}
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2 text-start">
                    <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold">
                      <Truck className="w-5 h-5" />
                    </div>
                    <h4 className="text-sm font-bold text-slate-900">
                      {t('1. حساب إجمالي الشراء الصافي', '1. Complete Net Purchase Cost')}
                    </h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {t(
                        'لا نكتفي بسعر السلعة فقط؛ بل نحدد مصاريف الشحن والرسوم الإضافية. إذا كانت تكلفة الشحن غير معلنة في المتجر، يتم تصنيف التكلفة كـ "غير مكتملة" منعاً للتضليل.',
                        'We compute base price + shipping + fees - discount. If shipping is unknown, total cost is never marked as confirmed.'
                      )}
                    </p>
                  </div>

                  <div className="space-y-2 text-start">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
                      <Scale className="w-5 h-5" />
                    </div>
                    <h4 className="text-sm font-bold text-slate-900">
                      {t('2. فصل الفئات والبدائل بدقة', '2. Variant Separation Discipline')}
                    </h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {t(
                        'لا يتم دمج المنتجات ذات السعات أو الألوان المختلفة كأنها منتج واحد (مثلاً: 128GB لا يُدمج مع 256GB). تُصنف الاختلافات كبدائل مقترحة لحماية المستهلك.',
                        'Conflicting capacities or variants are strictly classified as alternatives, preventing false comparisons.'
                      )}
                    </p>
                  </div>

                  <div className="space-y-2 text-start">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <h4 className="text-sm font-bold text-slate-900">
                      {t('3. توثيق الروابط وتاريخ الفحص', '3. Direct Links & Real Provenance')}
                    </h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {t(
                        'كل عرض يشتمل على رابط مباشر للمتجر وتاريخ آخر رصد وتوثيق للمصدر لضمان الثقة والاطمئنان عند إتمام عملية الشراء.',
                        'Every store offer contains direct store URLs, retrieval timestamps, and verification audit trails.'
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}

        {currentView === 'search' && <SearchResultsView />}
        {currentView === 'assistant' && <AiAssistantView />}
        {currentView === 'favorites' && <FavoritesView />}
        {currentView === 'admin' && <AdminDashboard />}
      </main>

      <ProductDetailsModal />
      <AuthModal />
      <Footer />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainContent />
    </AppProvider>
  );
}

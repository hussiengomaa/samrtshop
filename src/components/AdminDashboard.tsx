import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext.js';
import { Product, Store, ProviderHealth, MatchingReviewItem } from '../types/index.js';
import {
  Shield, BarChart3, Package, Store as StoreIcon, Activity, CheckSquare,
  Search, Plus, Trash2, Edit2, CheckCircle2, XCircle, AlertTriangle, RefreshCw,
  ExternalLink, Layers, ArrowUpRight
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line } from 'recharts';

export const AdminDashboard: React.FC = () => {
  const { lang, formatPrice, t } = useApp();
  const [activeTab, setActiveTab] = useState<'overview' | 'charts' | 'products' | 'offers' | 'providers' | 'reviews' | 'logs'>('overview');

  // Live state from backend
  const [kpis, setKpis] = useState<any>(null);
  const [chartsData, setChartsData] = useState<any>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [providersHealth, setProvidersHealth] = useState<ProviderHealth[]>([]);
  const [recentEvents, setRecentEvents] = useState<any[]>([]);
  const [matchingReviews, setMatchingReviews] = useState<MatchingReviewItem[]>([]);
  const [searchLogs, setSearchLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [probeResult, setProbeResult] = useState<any>(null);
  const [probing, setProbing] = useState<string | null>(null);

  // New product form modal state
  const [newProductModal, setNewProductModal] = useState(false);
  const [prodForm, setProdForm] = useState({
    name: '',
    name_ar: '',
    brand: '',
    model: '',
    category_id: 'cat_phones',
    image_url: ''
  });

  // New offer form modal state
  const [newOfferModal, setNewOfferModal] = useState(false);
  const [offerForm, setOfferForm] = useState({
    product_id: '',
    store_id: 'store_amazon_eg',
    source_url: '',
    product_price: '',
    shipping_cost: '',
    discount_amount: ''
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [kpiRes, chartsRes, prodsRes, storesRes, provRes, revRes] = await Promise.all([
        fetch('/api/admin/dashboard').then(r => r.json()),
        fetch('/api/admin/charts').then(r => r.json()),
        fetch('/api/products?limit=50').then(r => r.json()),
        fetch('/api/stores').then(r => r.json()),
        fetch('/api/admin/providers').then(r => r.json()),
        fetch('/api/admin/matching-reviews').then(r => r.json())
      ]);

      setKpis(kpiRes);
      setChartsData(chartsRes);
      setProducts(prodsRes.products || []);
      setStores(storesRes || []);
      setProvidersHealth(provRes.providers || []);
      setRecentEvents(provRes.recentEvents || []);
      setMatchingReviews(revRes || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleTestProvider = async (providerName: string) => {
    setProbing(providerName);
    setProbeResult(null);
    try {
      const res = await fetch(`/api/admin/providers/${providerName}/test`, { method: 'POST' });
      const data = await res.json();
      setProbeResult({ provider: providerName, ...data });
      loadData();
    } catch (e: any) {
      setProbeResult({ provider: providerName, error: e.message });
    } finally {
      setProbing(null);
    }
  };

  const handleReviewDecision = async (id: string, decision: 'approved' | 'rejected' | 'alternative') => {
    try {
      await fetch(`/api/admin/matching-reviews/${id}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision })
      });
      setMatchingReviews(prev => prev.map(r => r.id === id ? { ...r, status: decision as any } : r));
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodForm.name || !prodForm.name_ar) return;

    try {
      await fetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prodForm)
      });
      setNewProductModal(false);
      setProdForm({ name: '', name_ar: '', brand: '', model: '', category_id: 'cat_phones', image_url: '' });
      loadData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm(t('هل أنت متأكد من حذف هذا المنتج وجميع عروضه؟', 'Are you sure you want to delete this product?'))) return;
    try {
      await fetch(`/api/admin/products/${id}`, { method: 'DELETE' });
      loadData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!offerForm.product_id || !offerForm.source_url || !offerForm.product_price) return;

    try {
      await fetch('/api/admin/offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: offerForm.product_id,
          store_id: offerForm.store_id,
          source_url: offerForm.source_url,
          product_price: parseFloat(offerForm.product_price),
          shipping_cost: offerForm.shipping_cost ? parseFloat(offerForm.shipping_cost) : null,
          discount_amount: offerForm.discount_amount ? parseFloat(offerForm.discount_amount) : 0,
          verification_status: 'verified'
        })
      });
      setNewOfferModal(false);
      loadData();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      
      {/* Admin Top Header */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="bg-teal-500/20 text-teal-300 border border-teal-500/40 text-xs font-bold px-2.5 py-0.5 rounded-md flex items-center gap-1">
              <Shield className="w-3.5 h-3.5" />
              {t('بوابة الإدارة والرقابة المباشرة', 'Control & Administration Gateway')}
            </span>
            <span className="text-xs text-slate-400 font-medium">SQLite Real Persistence • Strict Integrity</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white">
            {t('لوحة تحكم منصة SmartShop AI', 'SmartShop AI Admin Dashboard')}
          </h2>
          <p className="text-xs text-slate-300 mt-1">
            {t('جميع المؤشرات والبيانات مسترجعة مباشرة من قاعدة البيانات وسجلات الفحص الفعلية.', 'All metrics and records are directly bound to SQLite tables and actual provider logs.')}
          </p>
        </div>

        <button
          onClick={loadData}
          disabled={loading}
          className="bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white px-4 py-2 rounded-xl text-xs font-bold border border-slate-700 flex items-center gap-2 self-start md:self-auto transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>{t('تحديث البيانات', 'Refresh Data')}</span>
        </button>
      </div>

      {/* Tabs Navigation */}
      <div className="flex overflow-x-auto gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
        {[
          { id: 'overview', icon: BarChart3, label: t('نظرة عامة ومؤشرات KPIs', 'Overview KPIs') },
          { id: 'charts', icon: Activity, label: t('الرسوم البيانية والتحليلات', 'Analytics & Trends') },
          { id: 'products', icon: Package, label: t('المنتجات والكاتالوج', 'Products Catalog') },
          { id: 'providers', icon: Shield, label: t('المزودات والتشخيص (Providers)', 'Provider Diagnostics') },
          { id: 'reviews', icon: CheckSquare, label: t('مراجعة المطابقة غير المؤكدة', 'Matching Review') }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-slate-900 text-teal-300 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: OVERVIEW KPIS */}
      {activeTab === 'overview' && kpis && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs text-slate-500 font-medium block mb-1">{t('إجمالي المنتجات', 'Total Products')}</span>
              <span className="text-2xl font-black text-slate-900">{kpis.totalProducts}</span>
              <span className="text-[10px] text-teal-700 font-bold block mt-1">{t('موثق في قاعدة البيانات', 'Persisted in DB')}</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs text-slate-500 font-medium block mb-1">{t('المتاجر النشطة', 'Active Stores')}</span>
              <span className="text-2xl font-black text-slate-900">{kpis.activeStores}</span>
              <span className="text-[10px] text-slate-500 block mt-1">Amazon, Noon, Jumia...</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs text-slate-500 font-medium block mb-1">{t('العروض المتوفرة', 'Active Offers')}</span>
              <span className="text-2xl font-black text-emerald-700">{kpis.activeOffers}</span>
              <span className="text-[10px] text-emerald-600 font-medium block mt-1">{t('حالة in_stock', 'In Stock')}</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs text-slate-500 font-medium block mb-1">{t('عروض بحاجة لتحديث', 'Outdated Offers')}</span>
              <span className="text-2xl font-black text-amber-700">{kpis.outdatedOffers}</span>
              <span className="text-[10px] text-amber-600 font-medium block mt-1">{t('> 14 يوماً من الفحص', '> 14 days old')}</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs text-slate-500 font-medium block mb-1">{t('عمليات البحث هذا الشهر', 'Searches This Month')}</span>
              <span className="text-2xl font-black text-sky-700">{kpis.searchesThisMonth}</span>
              <span className="text-[10px] text-slate-500 block mt-1">{kpis.searchesNoResults} {t('بدون نتائج', 'zero results')}</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs text-slate-500 font-medium block mb-1">{t('نجاح البحث الخارجي', 'External Success Rate')}</span>
              <span className="text-2xl font-black text-teal-700">{kpis.externalSuccessRate}%</span>
              <span className="text-[10px] text-teal-600 block mt-1">{t('بناء على استدعاءات المزود', 'Provider calls')}</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs text-slate-500 font-medium block mb-1">{t('تغطية المقارنة (Data Coverage)', 'Data Coverage %')}</span>
              <span className="text-2xl font-black text-indigo-700">{kpis.dataCoverage}%</span>
              <span className="text-[10px] text-slate-500 block mt-1">{t('منتجات بمتجرين فأكثر', '>=2 stores')}</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs text-slate-500 font-medium block mb-1">{t('أخطاء المزودات', 'Provider Errors')}</span>
              <span className="text-2xl font-black text-rose-700">{kpis.providerErrors}</span>
              <span className="text-[10px] text-rose-600 block mt-1">{t('أخطاء مسجلة وموثقة', 'Logged errors')}</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs text-slate-500 font-medium block mb-1">{t('متوسط زمن البحث', 'Avg Search Latency')}</span>
              <span className="text-2xl font-black text-slate-900">{kpis.averageSearchLatencyMs}ms</span>
              <span className="text-[10px] text-slate-500 block mt-1">{t('استجابة متكاملة', 'End-to-end')}</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs text-slate-500 font-medium block mb-1">{t('مراجعات قيد الفحص', 'Pending Reviews')}</span>
              <span className="text-2xl font-black text-amber-700">{matchingReviews.filter(r => r.status === 'pending').length}</span>
              <span className="text-[10px] text-amber-600 block mt-1">{t('مطابقات غير مؤكدة', 'Uncertain matches')}</span>
            </div>

          </div>
        </div>
      )}

      {/* TAB 2: CHARTS */}
      {activeTab === 'charts' && chartsData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Store Coverage Bar Chart */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h4 className="text-sm font-bold text-slate-900">
              {t('توزيع العروض حسب المتاجر المصرية (Offer Coverage by Store)', 'Offer Coverage by Store')}
            </h4>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartsData.storeCoverage}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name_ar" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} />
                  <Tooltip />
                  <Bar dataKey="offer_count" name={t('عدد العروض', 'Offers')} fill="#0d9488" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Search Logs Activity Chart */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h4 className="text-sm font-bold text-slate-900">
              {t('نشاط البحث عبر الأيام (Search Volume Over Time)', 'Search Activity Over Time')}
            </h4>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartsData.searchLogsTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} />
                  <Tooltip />
                  <Line type="monotone" dataKey="searches" name={t('عمليات البحث', 'Searches')} stroke="#2563eb" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>
      )}

      {/* TAB 3: PRODUCTS & OFFERS MANAGEMENT */}
      {activeTab === 'products' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {t('إدارة المنتجات والكاتالوج الرسمي', 'Product Catalog Management')}
              </h3>
              <p className="text-xs text-slate-500">
                {t('إضافة وتعديل المنتجات والعروض المرتبطة بها في المتاجر.', 'Add/edit products and linked store offers.')}
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setNewProductModal(true)}
                className="bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>{t('إضافة منتج جديد', 'Add Product')}</span>
              </button>

              <button
                onClick={() => {
                  if (products.length > 0) {
                    setOfferForm(prev => ({ ...prev, product_id: products[0].id }));
                  }
                  setNewOfferModal(true);
                }}
                className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>{t('إضافة عرض لمتجر', 'Add Store Offer')}</span>
              </button>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-start">
                <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4 text-start">{t('المنتج', 'Product')}</th>
                    <th className="py-3 px-4 text-start">{t('الماركة والموديل', 'Brand / Model')}</th>
                    <th className="py-3 px-4 text-start">{t('أقل سعر', 'Lowest Price')}</th>
                    <th className="py-3 px-4 text-start">{t('عدد العروض', 'Offers Count')}</th>
                    <th className="py-3 px-4 text-center">{t('إجراءات', 'Actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {products.map(prod => (
                    <tr key={prod.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={prod.image_url || 'https://via.placeholder.com/48'}
                            alt=""
                            className="w-10 h-10 object-contain rounded-lg border border-slate-200 p-0.5 bg-white"
                          />
                          <div>
                            <span className="font-bold text-slate-900 block">{prod.name_ar}</span>
                            <span className="text-[11px] text-slate-400 block">{prod.name}</span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-slate-700 font-semibold">
                        {prod.brand} {prod.model ? `• ${prod.model}` : ''}
                      </td>

                      <td className="py-3 px-4 font-black text-slate-900">
                        {formatPrice(prod.lowest_price)}
                      </td>

                      <td className="py-3 px-4">
                        <span className="bg-slate-100 px-2 py-0.5 rounded font-bold text-slate-700">
                          {prod.offers_count || prod.offers?.length || 0} {t('عروض', 'offers')}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleDeleteProduct(prod.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition-colors"
                          title={t('حذف', 'Delete')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: PROVIDERS DIAGNOSTICS */}
      {activeTab === 'providers' && (
        <div className="space-y-6">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {t('تشخيص المزودات الخارجية (External Provider Diagnostics)', 'Provider Diagnostics & Status')}
            </h3>
            <p className="text-xs text-slate-500">
              {t('مراقبة حالة التكامل مع Google Shopping عبر SerpApi ومزود Gemini Grounding واختبار الطلبات.', 'Monitor configuration, latency, and execute live diagnostic probes.')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {providersHealth.map(prov => (
              <div key={prov.provider} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-teal-500" />
                    <h4 className="font-bold text-slate-900 text-sm capitalize">
                      {prov.provider === 'serpapi' ? 'Provider A: SerpApi Google Shopping Egypt' : 'Provider B: Gemini with Google Search Grounding'}
                    </h4>
                  </div>
                  <span
                    className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                      prov.status === 'ok'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : prov.status === 'not_configured'
                        ? 'bg-slate-100 text-slate-600 border-slate-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}
                  >
                    {prov.status}
                  </span>
                </div>

                <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
                  {prov.message}
                </p>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-50 p-2.5 rounded-xl">
                    <span className="text-slate-400 block">{t('التهيئة (Configured):', 'Configured:')}</span>
                    <span className="font-bold text-slate-800">{prov.configured ? t('نعم', 'Yes') : t('لا (مفقود)', 'No (Missing)')}</span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-xl">
                    <span className="text-slate-400 block">{t('التفعيل (Enabled):', 'Enabled:')}</span>
                    <span className="font-bold text-slate-800">{prov.enabled ? t('مفعل', 'Enabled') : t('معطل', 'Disabled')}</span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-xl">
                    <span className="text-slate-400 block">{t('آخر استدعاء ناجح:', 'Last Success:')}</span>
                    <span className="font-bold text-slate-800">{prov.lastSuccessfulCall ? new Date(prov.lastSuccessfulCall).toLocaleTimeString() : '—'}</span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-xl">
                    <span className="text-slate-400 block">{t('مدة التخزين المؤقت:', 'Cache TTL:')}</span>
                    <span className="font-bold text-slate-800">{prov.cacheTtlMinutes} {t('دقيقة', 'mins')}</span>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => handleTestProvider(prov.provider)}
                    disabled={probing === prov.provider}
                    className="w-full bg-slate-900 hover:bg-teal-700 text-white font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${probing === prov.provider ? 'animate-spin' : ''}`} />
                    <span>{t('اختبار استدعاء حي الآن (Probe Request)', 'Test Live Probe')}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Diagnostic Probe Results */}
          {probeResult && (
            <div className="bg-slate-900 text-white rounded-2xl p-5 border border-slate-800 space-y-2">
              <h4 className="text-xs font-bold text-teal-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                {t('نتيجة فحص المزود الأخير:', 'Last Diagnostic Probe Result:')}
              </h4>
              <pre className="text-[11px] font-mono overflow-x-auto bg-slate-950 p-3 rounded-xl border border-slate-800 text-slate-300">
                {JSON.stringify(probeResult, null, 2)}
              </pre>
            </div>
          )}

          {/* Recent Provider Events Log */}
          <div>
            <h4 className="text-sm font-bold text-slate-900 mb-3">
              {t('سجل أحداث المزودات الأخيرة (Provider Events Log)', 'Recent Provider Events Log')}
            </h4>
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
              <table className="w-full text-xs text-start">
                <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-4 text-start">{t('الوقت', 'Time')}</th>
                    <th className="py-2.5 px-4 text-start">{t('المزود', 'Provider')}</th>
                    <th className="py-2.5 px-4 text-start">{t('النوع', 'Event')}</th>
                    <th className="py-2.5 px-4 text-start">{t('الحالة', 'Status')}</th>
                    <th className="py-2.5 px-4 text-start">{t('الزمن', 'Latency')}</th>
                    <th className="py-2.5 px-4 text-start">{t('النتائج', 'Results')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {recentEvents.map(evt => (
                    <tr key={evt.id} className="hover:bg-slate-50">
                      <td className="py-2 px-4 text-slate-500">{new Date(evt.timestamp).toLocaleTimeString()}</td>
                      <td className="py-2 px-4 font-bold text-slate-800 capitalize">{evt.provider}</td>
                      <td className="py-2 px-4 text-slate-600">{evt.event_type}</td>
                      <td className="py-2 px-4">
                        <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                          evt.status === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                        }`}>
                          {evt.status}
                        </span>
                      </td>
                      <td className="py-2 px-4 text-slate-600">{evt.latency_ms}ms</td>
                      <td className="py-2 px-4 font-bold text-slate-800">{evt.result_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: MATCHING REVIEWS (SECTION 12.6) */}
      {activeTab === 'reviews' && (
        <div className="space-y-6">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {t('مراجعة المطابقات غير المؤكدة (Matching Review)', 'Uncertain Match Review')}
            </h3>
            <p className="text-xs text-slate-500">
              {t('مراجعة العروض المرصودة خارجياً ذات نسبة التطابق الاحتمالية لمنع دمج الفئات المختلفة خطأً.', 'Review uncertain external matches to avoid merging conflicting product variants.')}
            </p>
          </div>

          <div className="space-y-4">
            {matchingReviews.length > 0 ? (
              matchingReviews.map(rev => (
                <div key={rev.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold px-2 py-0.5 rounded">
                        {t('نسبة التطابق:', 'Confidence:')} {Math.round(rev.match_confidence * 100)}%
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        rev.status === 'approved' ? 'bg-emerald-50 text-emerald-700' :
                        rev.status === 'rejected' ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {rev.status}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-slate-900">
                      {t('العرض المرصود:', 'Observed Title:')} {rev.candidate_title}
                    </h4>

                    <div className="text-xs text-slate-500 flex flex-wrap gap-3">
                      <span>{t('السعر المرصود:', 'Price:')} {formatPrice(rev.candidate_price)}</span>
                      <span>•</span>
                      <span>{t('المنتج المقترح بالمطابقة:', 'Suggested Match:')} <strong className="text-slate-800">{rev.matched_product_name || '—'}</strong></span>
                      {rev.notes && <span>• {rev.notes}</span>}
                    </div>
                  </div>

                  {rev.status === 'pending' && (
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => handleReviewDecision(rev.id, 'approved')}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{t('اعتماد كمطابق', 'Approve Match')}</span>
                      </button>

                      <button
                        onClick={() => handleReviewDecision(rev.id, 'alternative')}
                        className="bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
                      >
                        <Layers className="w-3.5 h-3.5" />
                        <span>{t('تعيين كبديل', 'Mark Alternative')}</span>
                      </button>

                      <button
                        onClick={() => handleReviewDecision(rev.id, 'rejected')}
                        className="bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>{t('رفض', 'Reject')}</span>
                      </button>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-500 text-sm">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <p className="font-semibold">{t('لا توجد مطابقات غير مؤكدة قيد الانتظار حالياً.', 'No pending uncertain matches for review.')}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: ADD PRODUCT */}
      {newProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 text-start space-y-4">
            <h3 className="text-base font-bold text-slate-900">{t('إضافة منتج جديد للكاتالوج', 'Add New Catalog Product')}</h3>
            <form onSubmit={handleCreateProduct} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">{t('الاسم بالعربية:', 'Arabic Name:')}</label>
                <input
                  type="text"
                  value={prodForm.name_ar}
                  onChange={e => setProdForm({ ...prodForm, name_ar: e.target.value })}
                  required
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">{t('الاسم بالإنجليزية:', 'English Name:')}</label>
                <input
                  type="text"
                  value={prodForm.name}
                  onChange={e => setProdForm({ ...prodForm, name: e.target.value })}
                  required
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{t('الماركة:', 'Brand:')}</label>
                  <input
                    type="text"
                    value={prodForm.brand}
                    onChange={e => setProdForm({ ...prodForm, brand: e.target.value })}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{t('الموديل:', 'Model:')}</label>
                  <input
                    type="text"
                    value={prodForm.model}
                    onChange={e => setProdForm({ ...prodForm, model: e.target.value })}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">{t('رابط الصورة:', 'Image URL:')}</label>
                <input
                  type="url"
                  value={prodForm.image_url}
                  onChange={e => setProdForm({ ...prodForm, image_url: e.target.value })}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setNewProductModal(false)}
                  className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold"
                >
                  {t('إلغاء', 'Cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-xl"
                >
                  {t('حفظ المنتج', 'Save Product')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD OFFER */}
      {newOfferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 text-start space-y-4">
            <h3 className="text-base font-bold text-slate-900">{t('إضافة عرض متجر جديد', 'Add Store Offer')}</h3>
            <form onSubmit={handleCreateOffer} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">{t('المنتج:', 'Product:')}</label>
                <select
                  value={offerForm.product_id}
                  onChange={e => setOfferForm({ ...offerForm, product_id: e.target.value })}
                  required
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm"
                >
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name_ar} ({p.name})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">{t('المتجر:', 'Store:')}</label>
                <select
                  value={offerForm.store_id}
                  onChange={e => setOfferForm({ ...offerForm, store_id: e.target.value })}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm"
                >
                  {stores.map(s => (
                    <option key={s.id} value={s.id}>{s.name_ar} ({s.name})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{t('سعر السلعة (ج.م):', 'Price:')}</label>
                  <input
                    type="number"
                    value={offerForm.product_price}
                    onChange={e => setOfferForm({ ...offerForm, product_price: e.target.value })}
                    required
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{t('الشحن (ج.م):', 'Shipping:')}</label>
                  <input
                    type="number"
                    value={offerForm.shipping_cost}
                    onChange={e => setOfferForm({ ...offerForm, shipping_cost: e.target.value })}
                    placeholder={t('اختياري', 'Optional')}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{t('الخصم (ج.م):', 'Discount:')}</label>
                  <input
                    type="number"
                    value={offerForm.discount_amount}
                    onChange={e => setOfferForm({ ...offerForm, discount_amount: e.target.value })}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">{t('رابط صفحة المتجر:', 'Source URL:')}</label>
                <input
                  type="url"
                  value={offerForm.source_url}
                  onChange={e => setOfferForm({ ...offerForm, source_url: e.target.value })}
                  required
                  placeholder="https://..."
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setNewOfferModal(false)}
                  className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold"
                >
                  {t('إلغاء', 'Cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl"
                >
                  {t('حفظ العرض', 'Save Offer')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

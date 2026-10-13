import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext.js';
import { ProductCard } from './ProductCard.js';
import { Product, PriceAlertItem } from '../types/index.js';
import { Heart, Bell, Trash2, ArrowLeft, ArrowRight, Store } from 'lucide-react';

export const FavoritesView: React.FC = () => {
  const { favorites, setSelectedProductId, formatPrice, lang, t } = useApp();
  const [favoriteProducts, setFavoriteProducts] = useState<Product[]>([]);
  const [priceAlerts, setPriceAlerts] = useState<PriceAlertItem[]>([]);
  const [activeTab, setActiveTab] = useState<'favorites' | 'alerts'>('favorites');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch('/api/products').then(res => res.json()),
      fetch('/api/price-alerts').then(res => res.json())
    ])
      .then(([productsRes, alertsRes]) => {
        const allProds: Product[] = productsRes.products || [];
        setFavoriteProducts(allProds.filter(p => favorites.includes(p.id)));
        setPriceAlerts(alertsRes || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [favorites]);

  const handleDeleteAlert = async (id: string) => {
    try {
      await fetch(`/api/price-alerts/${id}`, { method: 'DELETE' });
      setPriceAlerts(prev => prev.filter(a => a.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-2xl font-black text-slate-900 mb-1">
            {t('المفضلة وتنبيهات الأسعار', 'Favorites & Price Alerts')}
          </h2>
          <p className="text-xs text-slate-500">
            {t('متابعة المنتجات المحفوظة والتنبيهات المخصصة لك.', 'Manage your saved products and active price monitoring.')}
          </p>
        </div>

        {/* Tab Toggle */}
        <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold">
          <button
            onClick={() => setActiveTab('favorites')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
              activeTab === 'favorites' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Heart className="w-3.5 h-3.5 text-rose-500" />
            <span>{t('المنتجات المفضلة', 'Saved Products')} ({favoriteProducts.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('alerts')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
              activeTab === 'alerts' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Bell className="w-3.5 h-3.5 text-teal-600" />
            <span>{t('تنبيهات الأسعار', 'Price Alerts')} ({priceAlerts.length})</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center">
          <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : activeTab === 'favorites' ? (
        favoriteProducts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {favoriteProducts.map(p => (
              <ProductCard key={p.id} product={p} originBadge="catalog" />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center max-w-md mx-auto space-y-3">
            <Heart className="w-10 h-10 text-slate-300 mx-auto" />
            <h4 className="text-base font-bold text-slate-800">
              {t('لا توجد منتجات محفوظة في المفضلة', 'No saved products yet')}
            </h4>
            <p className="text-xs text-slate-500">
              {t('انقر على أيقونة القلب على أي منتج لحفظه ومقارنته في أي وقت.', 'Click the heart icon on any product to save and compare it easily.')}
            </p>
          </div>
        )
      ) : (
        priceAlerts.length > 0 ? (
          <div className="space-y-3 max-w-2xl mx-auto">
            {priceAlerts.map(alert => (
              <div
                key={alert.id}
                className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between shadow-xs"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">
                    <Bell className="w-5 h-5" />
                  </div>
                  <div>
                    <h4
                      onClick={() => setSelectedProductId(alert.product_id)}
                      className="text-sm font-bold text-slate-900 hover:text-teal-700 cursor-pointer"
                    >
                      {alert.product_name_ar || alert.product_name || 'منتج محدد'}
                    </h4>
                    <p className="text-xs text-slate-500">
                      {t('التنبيه عند سعر:', 'Alert target:')}{' '}
                      <span className="font-bold text-emerald-700">{formatPrice(alert.target_price)}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold px-2 py-0.5 rounded-full">
                    {t('نشط', 'Active')}
                  </span>
                  <button
                    onClick={() => handleDeleteAlert(alert.id)}
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    title={t('حذف التنبيه', 'Delete Alert')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center max-w-md mx-auto space-y-3">
            <Bell className="w-10 h-10 text-slate-300 mx-auto" />
            <h4 className="text-base font-bold text-slate-800">
              {t('لا توجد تنبيهات أسعار نشطة', 'No active price alerts')}
            </h4>
            <p className="text-xs text-slate-500">
              {t('يمكنك ضبط تنبيه من خلال تفاصيل أي منتج عند وصوله للسعر المستهدف.', 'Set a price target alert inside any product details view.')}
            </p>
          </div>
        )
      )}

    </div>
  );
};

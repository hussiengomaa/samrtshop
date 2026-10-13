import React, { useEffect, useState } from 'react';
import { Product, ProductOffer, PriceHistoryRecord } from '../types/index.js';
import { useApp } from '../context/AppContext.js';
import { X, ExternalLink, ShieldCheck, Truck, CheckCircle2, AlertTriangle, Bell, Heart, Store, Calendar, TrendingDown, Info } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

export const ProductDetailsModal: React.FC = () => {
  const { selectedProductId, setSelectedProductId, formatPrice, favorites, toggleFavorite, lang, t } = useApp();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);
  const [alertModalOpen, setAlertModalOpen] = useState(false);
  const [targetAlertPrice, setTargetAlertPrice] = useState<string>('');
  const [alertCreated, setAlertCreated] = useState(false);

  useEffect(() => {
    if (!selectedProductId) {
      setProduct(null);
      return;
    }

    setLoading(true);
    fetch(`/api/products/${selectedProductId}`)
      .then(res => res.json())
      .then(data => {
        setProduct(data);
        if (data.lowest_price) {
          setTargetAlertPrice(String(Math.round(data.lowest_price * 0.95))); // 5% below lowest
        }
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [selectedProductId]);

  if (!selectedProductId) return null;

  const isFavorite = selectedProductId ? favorites.includes(selectedProductId) : false;
  const title = lang === 'ar' ? product?.name_ar : product?.name;

  // Find lowest complete total cost
  const completeOffers = product?.offers?.filter(o => o.is_total_cost_complete && o.total_cost !== null) || [];
  const lowestCompleteTotal = completeOffers.length > 0
    ? Math.min(...completeOffers.map(o => o.total_cost!))
    : null;

  const handleCreateAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetAlertPrice || !selectedProductId) return;

    try {
      await fetch('/api/price-alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: selectedProductId,
          targetPrice: parseFloat(targetAlertPrice)
        })
      });
      setAlertCreated(true);
      setTimeout(() => {
        setAlertCreated(false);
        setAlertModalOpen(false);
      }, 1800);
    } catch (e) {
      console.error(e);
    }
  };

  // Prepare price history data for Recharts
  const historyData = (product as any)?.price_history?.map((ph: PriceHistoryRecord) => ({
    date: ph.recorded_at ? new Date(ph.recorded_at).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric' }) : '',
    price: ph.recorded_price,
    store: ph.store_name || 'Store'
  })) || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92vh] flex flex-col">
        
        {/* Header Modal Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/80 sticky top-0 z-10 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <span className="bg-teal-100 text-teal-800 text-xs font-bold px-2.5 py-1 rounded-md">
              {product?.brand || 'SmartShop'}
            </span>
            <span className="text-xs text-slate-500 font-medium">
              {t('مقارنة الأسعار الرسمية في مصر', 'Verified Price Comparison Egypt')}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => toggleFavorite(selectedProductId)}
              className={`p-2 rounded-xl border transition-colors ${
                isFavorite
                  ? 'bg-rose-50 text-rose-500 border-rose-200'
                  : 'bg-white text-slate-400 hover:text-rose-500 border-slate-200'
              }`}
              title={isFavorite ? t('إزالة من المفضلة', 'Remove Favorite') : t('إضافة للمفضلة', 'Save to Favorites')}
            >
              <Heart className={`w-4 h-4 ${isFavorite ? 'fill-rose-500' : ''}`} />
            </button>

            <button
              onClick={() => setAlertModalOpen(true)}
              className="p-2 rounded-xl bg-white text-slate-600 hover:text-teal-600 border border-slate-200 hover:border-teal-300 transition-colors"
              title={t('تنبيه عند انخفاض السعر', 'Price Drop Alert')}
            >
              <Bell className="w-4 h-4" />
            </button>

            <button
              onClick={() => setSelectedProductId(null)}
              className="p-2 rounded-xl bg-slate-200/80 hover:bg-slate-300 text-slate-700 transition-colors"
              title={t('إغلاق', 'Close')}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-8">
          
          {loading ? (
            <div className="py-20 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-teal-500 border-t-transparent" />
              <p className="mt-3 text-sm text-slate-500">{t('جاري جلب تفاصيل المنتج والعروض...', 'Loading product details and offers...')}</p>
            </div>
          ) : product ? (
            <>
              {/* Top Overview Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center bg-slate-50 p-6 rounded-2xl border border-slate-200/80">
                <div className="h-56 bg-white rounded-xl p-4 flex items-center justify-center border border-slate-200 shadow-xs">
                  {product.image_url ? (
                    <img src={product.image_url} alt={title || ''} className="max-h-full max-w-full object-contain" />
                  ) : (
                    <span className="text-slate-400 text-xs">{t('لا توجد صورة', 'No Image')}</span>
                  )}
                </div>

                <div className="md:col-span-2 space-y-3">
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 leading-snug">
                    {title}
                  </h2>

                  <div className="flex flex-wrap gap-2 text-xs">
                    {product.model && (
                      <span className="bg-slate-200/80 text-slate-700 font-semibold px-2.5 py-1 rounded-md">
                        {t('الموديل:', 'Model:')} {product.model}
                      </span>
                    )}
                    {product.category && (
                      <span className="bg-slate-200/80 text-slate-700 font-semibold px-2.5 py-1 rounded-md">
                        {lang === 'ar' ? product.category.name_ar : product.category.name}
                      </span>
                    )}
                  </div>

                  {/* Lowest Summary */}
                  <div className="pt-2 flex flex-wrap items-baseline gap-4">
                    <div>
                      <span className="text-xs text-slate-500 block mb-0.5">{t('أقل سعر معروض بالمتجر:', 'Lowest Store Price:')}</span>
                      <span className="text-2xl font-black text-teal-700">
                        {formatPrice(product.lowest_price)}
                      </span>
                    </div>

                    {lowestCompleteTotal && (
                      <div className="bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl">
                        <span className="text-[11px] text-emerald-800 font-medium block">
                          {t('أرخص تكلفة إجمالية مؤكدة (شاملة الشحن):', 'Lowest Confirmed Total (incl. shipping):')}
                        </span>
                        <span className="text-lg font-black text-emerald-900">
                          {formatPrice(lowestCompleteTotal)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Price Comparison Table Across Egyptian Stores */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <Store className="w-4 h-4 text-teal-600" />
                      {t('جدول مقارنة الأسعار والشحن عبر المتاجر', 'Store Price & Shipping Comparison')}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {t('يتم حساب إجمالي الشراء الصافي ولا يُفترض الشحن المجاني إلا إذا كان معلناً صراحة.', 'Net total calculated. Free shipping is never assumed unless explicitly verified.')}
                    </p>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-start">
                      <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                        <tr>
                          <th className="py-3 px-4 text-start">{t('المتجر', 'Store')}</th>
                          <th className="py-3 px-4 text-start">{t('سعر السلعة', 'Price')}</th>
                          <th className="py-3 px-4 text-start">{t('مصاريف الشحن', 'Shipping')}</th>
                          <th className="py-3 px-4 text-start">{t('الخصم المطبق', 'Discount')}</th>
                          <th className="py-3 px-4 text-start">{t('التكلفة الإجمالية', 'Total Cost')}</th>
                          <th className="py-3 px-4 text-start">{t('حالة التحقق', 'Verification')}</th>
                          <th className="py-3 px-4 text-center">{t('الرابط', 'Link')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {product.offers?.map((offer) => {
                          const isLowestConfirmed = Boolean(
                            lowestCompleteTotal !== null &&
                            offer.is_total_cost_complete &&
                            offer.total_cost === lowestCompleteTotal
                          );

                          return (
                            <tr
                              key={offer.id}
                              className={`hover:bg-slate-50/80 transition-colors ${
                                isLowestConfirmed ? 'bg-emerald-50/50' : ''
                              }`}
                            >
                              <td className="py-3.5 px-4 font-bold text-slate-900 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-teal-500" />
                                {offer.store?.name_ar || offer.store?.name || offer.store_name || t('متجر عبر الإنترنت', 'Online Store')}
                                {isLowestConfirmed && (
                                  <span className="bg-emerald-600 text-white text-[10px] px-1.5 py-0.5 rounded font-bold">
                                    {t('الأرخص إجمالاً', 'Best Total')}
                                  </span>
                                )}
                              </td>

                              <td className="py-3.5 px-4 font-black text-slate-950 text-sm">
                                {formatPrice(offer.product_price)}
                              </td>

                              <td className="py-3.5 px-4">
                                {offer.shipping_cost === null || offer.shipping_cost === undefined ? (
                                  <span className="text-amber-700 font-medium flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded text-[11px] w-fit">
                                    <AlertTriangle className="w-3 h-3 text-amber-500" />
                                    {t('غير محدد', 'Unknown')}
                                  </span>
                                ) : offer.shipping_cost === 0 ? (
                                  <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded text-[11px] w-fit">
                                    {t('شحن مجاني', 'Free')}
                                  </span>
                                ) : (
                                  <span className="font-semibold text-slate-700">
                                    {formatPrice(offer.shipping_cost)}
                                  </span>
                                )}
                              </td>

                              <td className="py-3.5 px-4">
                                {offer.discount_amount && offer.discount_amount > 0 ? (
                                  <span className="text-emerald-600 font-bold">
                                    -{formatPrice(offer.discount_amount)}
                                  </span>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>

                              <td className="py-3.5 px-4">
                                {offer.is_total_cost_complete ? (
                                  <span className={`font-black text-sm ${isLowestConfirmed ? 'text-emerald-700' : 'text-slate-900'}`}>
                                    {formatPrice(offer.total_cost)}
                                  </span>
                                ) : (
                                  <div className="text-[11px] text-amber-800">
                                    <span>{formatPrice(offer.product_price)}</span>
                                    <span className="block text-[10px] text-amber-600 font-medium">({t('غير مؤكد لغياب الشحن', 'Unconfirmed total')})</span>
                                  </div>
                                )}
                              </td>

                              <td className="py-3.5 px-4">
                                {offer.verification_status === 'verified' ? (
                                  <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-bold text-[10px] inline-flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                    {t('مؤكد ومفحوص', 'Verified')}
                                  </span>
                                ) : (
                                  <span className="text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full font-medium text-[10px]">
                                    {t('غير مؤكد', 'Unverified')}
                                  </span>
                                )}
                              </td>

                              <td className="py-3.5 px-4 text-center">
                                <a
                                  href={offer.source_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 bg-slate-900 hover:bg-teal-600 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition-colors"
                                >
                                  <span>{t('شراء', 'Buy')}</span>
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Real Recorded Price History (Recharts) */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <TrendingDown className="w-4 h-4 text-teal-600" />
                      {t('سجل تغير الأسعار الفعلي (Price History)', 'Actual Historical Price Observations')}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {t('يتم تسجيل النقاط فقط عند رصد سعر فعلي حقيقي، دون اختراع بيانات سابقة.', 'Plotted exclusively from real recorded observations. No simulated prices.')}
                    </p>
                  </div>
                </div>

                {historyData.length > 0 ? (
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={historyData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="date" stroke="#64748b" fontSize={11} />
                        <YAxis stroke="#64748b" fontSize={11} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                        <Tooltip
                          formatter={(value: any) => [`${Number(value).toLocaleString()} ج.م`, 'السعر']}
                          labelFormatter={(label) => `التاريخ: ${label}`}
                        />
                        <Line
                          type="monotone"
                          dataKey="price"
                          stroke="#0d9488"
                          strokeWidth={2.5}
                          dot={{ r: 4, fill: '#0d9488' }}
                          activeDot={{ r: 6 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-center text-slate-500 text-xs">
                    <Info className="w-5 h-5 mx-auto mb-1 text-slate-400" />
                    {t('لا توجد سجلات تاريخية سابقة مسجلة حتى الآن لهذا المنتج.', 'No prior historical observations recorded for this product yet.')}
                  </div>
                )}
              </div>

              {/* Product Specifications */}
              {product.specifications && Object.keys(product.specifications).length > 0 && (
                <div>
                  <h3 className="text-base font-bold text-slate-900 mb-3">
                    {t('المواصفات الفنية المؤكدة', 'Verified Specifications')}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {Object.entries(product.specifications).map(([key, val]) => (
                      <div key={key} className="bg-slate-50 border border-slate-200/80 p-2.5 rounded-xl flex justify-between text-xs">
                        <span className="text-slate-500 font-medium capitalize">{key}:</span>
                        <span className="font-bold text-slate-800 text-end">{String(val)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </>
          ) : null}

        </div>

      </div>

      {/* Price Alert Dialog Modal */}
      {alertModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 text-start">
            <h4 className="text-base font-bold text-slate-900 mb-2">
              {t('تنبيه عند انخفاض السعر', 'Set Price Drop Alert')}
            </h4>
            <p className="text-xs text-slate-500 mb-4">
              {t('حدد السعر المستهدف وسنقوم بتسجيل التنبيه ومتابعته.', 'Enter your target budget. We will monitor observations for drops.')}
            </p>

            {alertCreated ? (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs p-3 rounded-xl flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                {t('تم تسجيل التنبيه بنجاح!', 'Alert created successfully!')}
              </div>
            ) : (
              <form onSubmit={handleCreateAlert} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t('السعر المستهدف (ج.م):', 'Target Price (EGP):')}
                  </label>
                  <input
                    type="number"
                    value={targetAlertPrice}
                    onChange={(e) => setTargetAlertPrice(e.target.value)}
                    required
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                  />
                </div>

                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setAlertModalOpen(false)}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    {t('إلغاء', 'Cancel')}
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 text-xs font-bold bg-teal-600 text-white rounded-lg hover:bg-teal-500 shadow-xs"
                  >
                    {t('تفعيل التنبيه', 'Activate Alert')}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

    </div>
  );
};

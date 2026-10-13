import React from 'react';
import { Product } from '../types/index.js';
import { useApp } from '../context/AppContext.js';
import { Heart, Store, ExternalLink, ShieldCheck, Truck, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';

interface ProductCardProps {
  product: Product;
  originBadge?: 'catalog' | 'external' | 'alternative';
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, originBadge = 'catalog' }) => {
  const { lang, formatPrice, favorites, toggleFavorite, setSelectedProductId, t } = useApp();

  const isFavorite = favorites.includes(product.id);
  const title = lang === 'ar' ? product.name_ar : product.name;
  const bestOffer = product.offers?.[0];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col overflow-hidden group">
      
      {/* Top Media Bar */}
      <div className="relative h-48 bg-slate-100 flex items-center justify-center p-4 overflow-hidden">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={title}
            className="w-full h-full object-contain mix-blend-multiply group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="text-slate-400 text-xs font-medium">
            {t('لا توجد صورة متوفرة', 'No image available')}
          </div>
        )}

        {/* Origin Badge */}
        <div className="absolute top-3 start-3">
          {originBadge === 'catalog' && (
            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
              <ShieldCheck className="w-3 h-3 text-emerald-600" />
              {t('موثق في المنصة', 'Verified Catalog')}
            </span>
          )}
          {originBadge === 'external' && (
            <span className="bg-sky-50 text-sky-700 border border-sky-200 text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
              <Store className="w-3 h-3 text-sky-600" />
              {t('اكتشاف خارجي', 'External Discovery')}
            </span>
          )}
          {originBadge === 'alternative' && (
            <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
              <AlertCircle className="w-3 h-3 text-amber-600" />
              {t('بديل مقترح', 'Suggested Alternative')}
            </span>
          )}
        </div>

        {/* Favorite Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleFavorite(product.id);
          }}
          className={`absolute top-3 end-3 w-8 h-8 rounded-full flex items-center justify-center transition-colors shadow-xs ${
            isFavorite
              ? 'bg-rose-50 text-rose-500 border border-rose-200'
              : 'bg-white/90 text-slate-400 hover:text-rose-500 hover:bg-white border border-slate-200'
          }`}
          title={isFavorite ? t('إزالة من المفضلة', 'Remove favorite') : t('إضافة للمفضلة', 'Add to favorites')}
        >
          <Heart className={`w-4 h-4 ${isFavorite ? 'fill-rose-500' : ''}`} />
        </button>
      </div>

      {/* Card Content */}
      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>
          {/* Brand & Model */}
          {product.brand && (
            <div className="text-[11px] font-bold text-teal-700 uppercase tracking-wider mb-1">
              {product.brand} {product.model ? `• ${product.model}` : ''}
            </div>
          )}

          {/* Product Name */}
          <h3
            onClick={() => setSelectedProductId(product.id)}
            className="text-sm font-bold text-slate-900 line-clamp-2 hover:text-teal-700 cursor-pointer mb-3 leading-snug"
          >
            {title}
          </h3>
        </div>

        {/* Pricing Breakdown Section */}
        <div className="pt-3 border-t border-slate-100 mt-2">
          
          <div className="flex items-baseline justify-between mb-1">
            <span className="text-xs text-slate-500">{t('أقل سعر معروض:', 'Lowest Price:')}</span>
            <span className="text-lg font-black text-slate-950">
              {formatPrice(product.lowest_price)}
            </span>
          </div>

          {/* Confirmed Total Cost Indicator */}
          {bestOffer && (
            <div className="text-[11px] text-slate-600 flex items-center justify-between mb-3 bg-slate-50 p-1.5 rounded-lg border border-slate-100">
              <span className="flex items-center gap-1 text-slate-500">
                <Truck className="w-3 h-3 text-slate-400" />
                {t('التكلفة مع الشحن:', 'Total with Shipping:')}
              </span>
              {bestOffer.is_total_cost_complete ? (
                <span className="font-bold text-emerald-700">
                  {formatPrice(bestOffer.total_cost)}
                </span>
              ) : (
                <span className="text-amber-700 font-medium">
                  {t('الشحن غير محدد', 'Shipping unknown')}
                </span>
              )}
            </div>
          )}

          {/* Best Store Info */}
          <div className="flex items-center justify-between text-xs text-slate-500 mb-4">
            <span className="flex items-center gap-1.5 font-medium text-slate-700">
              <Store className="w-3.5 h-3.5 text-teal-600" />
              {bestOffer?.store?.name_ar || bestOffer?.store_name || t('متاجر متعددة', 'Multiple stores')}
            </span>
            <span className="bg-slate-100 px-2 py-0.5 rounded text-[11px] font-semibold text-slate-600">
              {product.offers_count || 1} {t('عروض متاحة', 'offers')}
            </span>
          </div>

          {/* Action Button */}
          <button
            onClick={() => setSelectedProductId(product.id)}
            className="w-full bg-slate-900 hover:bg-teal-700 text-white font-bold py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-2 transition-colors active:scale-98 shadow-xs"
          >
            <span>{t('مقارنة العروض والتفاصيل', 'Compare All Offers')}</span>
            {lang === 'ar' ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>

        </div>

      </div>

    </div>
  );
};

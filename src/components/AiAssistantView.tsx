import React, { useState } from 'react';
import { useApp } from '../context/AppContext.js';
import { AssistantRecommendation } from '../types/index.js';
import { Sparkles, Send, CheckCircle2, AlertCircle, ExternalLink, ArrowRight, ArrowLeft, Store, ShieldCheck, DollarSign } from 'lucide-react';

export const AiAssistantView: React.FC = () => {
  const { lang, formatPrice, setSelectedProductId, t } = useApp();
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [recommendation, setRecommendation] = useState<AssistantRecommendation | null>(null);

  const samplePrompts = [
    { ar: 'عايز موبايل في حدود 10000 جنيه.', en: 'I want a phone under 10,000 EGP.' },
    { ar: 'رشح لي لابتوب ممتاز للدراسة والبرمجة بميزانية متوسطة.', en: 'Recommend a good laptop for study and programming.' },
    { ar: 'عايز غسالة موفرة للكهرباء وسعرها مناسب.', en: 'I need an energy-saving washing machine.' },
    { ar: 'أرخص عرض متوفر لـ iPhone 15 Pro في المتاجر المصرية.', en: 'Find the cheapest available offer for iPhone 15 Pro.' }
  ];

  const handleSend = async (messageText?: string) => {
    const textToSend = (messageText || inputMessage).trim();
    if (!textToSend || loading) return;

    setLoading(true);
    setInputMessage('');

    try {
      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: textToSend })
      });
      const data = await res.json();
      setRecommendation(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      
      {/* Assistant Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-teal-950 text-white rounded-3xl p-6 sm:p-8 border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 end-0 w-64 h-64 bg-teal-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-start gap-4 relative z-10">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-teal-400 to-cyan-400 flex items-center justify-center text-slate-950 font-bold shadow-lg shadow-teal-500/20 shrink-0">
            <Sparkles className="w-6 h-6 text-slate-950" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 bg-teal-500/20 text-teal-300 text-xs font-bold px-2.5 py-0.5 rounded-full border border-teal-500/30 mb-2">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{t('توصيات مدعومة ببيانات وعروض حقيقية', 'Grounded in Real Store Data')}</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white mb-1">
              {t('مساعد التسوق الذكي — SmartShop AI', 'Smart Shopping AI Assistant')}
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-2xl">
              {t(
                'اطلب باللغة العربية أو الإنجليزية أو بالعامية المصرية. المساعد يفهم متطلباتك وميزانيتك بالجنيه المصري، ويلتزم بالأسعار الواقعية المتوفرة في المتاجر دون تخمين.',
                'Chat in Arabic or English. The assistant understands your budget in EGP and recommends verified offers from actual Egyptian stores.'
              )}
            </p>
          </div>
        </div>

        {/* Quick Prompts Chips */}
        <div className="mt-6 pt-5 border-t border-slate-700/80">
          <span className="text-xs font-semibold text-slate-400 block mb-2">
            {t('أمثلة جاهزة للتجربة السريعة:', 'Quick Preset Prompts:')}
          </span>
          <div className="flex flex-wrap gap-2">
            {samplePrompts.map((sp, idx) => {
              const text = lang === 'ar' ? sp.ar : sp.en;
              return (
                <button
                  key={idx}
                  onClick={() => handleSend(text)}
                  className="bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-slate-200 hover:text-white px-3 py-1.5 rounded-xl text-xs font-medium transition-colors text-start"
                >
                  {text}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Chat Input Bar */}
      <div className="bg-white rounded-2xl border-2 border-slate-200 shadow-sm p-2 focus-within:border-teal-500 transition-all">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder={t(
              'اكتب طلبك هنا (مثال: عايز موبايل ممتاز في حدود 15000 وبطاريته تعيش)...',
              'Type your shopping request here (e.g. recommend a laptop under 25k)...'
            )}
            className="flex-1 px-4 py-2.5 text-sm sm:text-base text-slate-900 placeholder-slate-400 focus:outline-none"
          />
          <button
            type="submit"
            disabled={loading || !inputMessage.trim()}
            className="bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white font-bold p-3 rounded-xl transition-all shadow-xs flex items-center justify-center shrink-0"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </form>
      </div>

      {/* Results Container */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
          <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <h4 className="text-sm font-bold text-slate-800">
            {t('جاري تحليل الطلب ومطابقة أفضل العروض في المتاجر...', 'Analyzing request and matching best store offers...')}
          </h4>
          <p className="text-xs text-slate-500">
            {t('نقوم بتطبيق شروط الميزانية والمواصفات بشكل صارم.', 'Strictly enforcing budget constraints and verified specs.')}
          </p>
        </div>
      ) : recommendation ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
          
          {/* Summary Box */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5">
            <h3 className="text-sm font-bold text-teal-800 mb-1 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-teal-600" />
              {t('تحليل المساعد الذكي', 'Assistant Analysis')}
            </h3>
            <p className="text-sm text-slate-800 font-medium leading-relaxed">
              {lang === 'ar' ? recommendation.summary_ar : recommendation.summary}
            </p>

            {/* Budget Notice if present */}
            {(recommendation.budgetNotice || recommendation.budgetNotice_ar) && (
              <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg w-fit">
                <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                <span>{lang === 'ar' ? recommendation.budgetNotice_ar : recommendation.budgetNotice}</span>
              </div>
            )}
          </div>

          {/* Recommended Products Grid */}
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-slate-900">
              {t('الخيارات الموصى بها والمطابقة للميزانية:', 'Recommended Products Matching Your Criteria:')}
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {recommendation.recommendedProducts.map((prod, idx) => (
                <div
                  key={idx}
                  className="border border-slate-200 rounded-2xl p-5 bg-white hover:border-teal-400 hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-teal-700 uppercase">
                        {prod.brand || 'Product'}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          prod.matchType === 'exact'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        {prod.matchType === 'exact' ? t('مطابق تماماً', 'Exact Match') : t('بديل مقترح', 'Alternative')}
                      </span>
                    </div>

                    <h5 className="text-sm font-bold text-slate-900 leading-snug">
                      {lang === 'ar' ? prod.productNameAr : prod.productName}
                    </h5>

                    <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100 leading-relaxed">
                      {lang === 'ar' ? prod.reason_ar : prod.reason}
                    </p>

                    {(prod.tradeOffs || prod.tradeOffs_ar) && (
                      <div className="text-[11px] text-amber-800 bg-amber-50/70 p-2 rounded-lg border border-amber-100 flex items-start gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                        <span>{lang === 'ar' ? prod.tradeOffs_ar : prod.tradeOffs}</span>
                      </div>
                    )}
                  </div>

                  {/* Best Offer Bar */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <div>
                      <span className="text-[11px] text-slate-500 block">
                        {prod.bestOffer.storeName}:
                      </span>
                      <span className="text-base font-black text-slate-950">
                        {formatPrice(prod.bestOffer.price)}
                      </span>
                      {prod.bestOffer.shippingCost !== null && (
                        <span className="text-[10px] text-slate-500 block">
                          + {prod.bestOffer.shippingCost === 0 ? t('شحن مجاني', 'Free Shipping') : `${prod.bestOffer.shippingCost} ج.م شحن`}
                        </span>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => setSelectedProductId(prod.productId)}
                        className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-3 py-2 rounded-xl transition-colors"
                      >
                        {t('المقارنة', 'Compare')}
                      </button>

                      {prod.bestOffer.sourceUrl && (
                        <a
                          href={prod.bestOffer.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs p-2 rounded-xl transition-colors flex items-center justify-center"
                          title={t('شراء من المتجر', 'Buy from Store')}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>

                </div>
              ))}
            </div>
          </div>

        </div>
      ) : null}

    </div>
  );
};

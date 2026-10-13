import React from 'react';
import { useApp } from '../context/AppContext.js';
import { ShieldCheck, Store, Heart, Info, FileText, Lock } from 'lucide-react';

export const Footer: React.FC = () => {
  const { t } = useApp();

  return (
    <footer className="bg-slate-900 border-t border-slate-800 text-slate-400 text-xs py-12 px-4 sm:px-6 lg:px-8 mt-16">
      <div className="max-w-7xl mx-auto space-y-8">
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-8 border-b border-slate-800">
          
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center gap-2">
              <span className="font-black text-lg text-white">SmartShop AI</span>
              <span className="bg-teal-500/20 text-teal-400 text-[10px] px-2 py-0.5 rounded font-bold border border-teal-500/30">مصر Egypt</span>
            </div>
            <p className="text-slate-400 text-xs leading-relaxed max-w-md">
              {t(
                'منصة مقارنة الأسعار ومساعد التسوق الذكي للمستهلك المصري. نعتمد على استرجاع الأسعار الفعلية وحساب التكاليف الإجمالية وتوضيح مصادر العروض بشفافية كاملة دون بيانات مصطنعة.',
                'Production-oriented smart price comparison and shopping assistant for Egyptian consumers. Grounded in real external discovery and transparent cost calculation.'
              )}
            </p>
          </div>

          <div>
            <h4 className="font-bold text-white mb-3 text-sm">{t('روابط هامة', 'Quick Links')}</h4>
            <ul className="space-y-2">
              <li><a href="#" className="hover:text-teal-400 transition-colors">{t('عن المنصة ومبدأ العمل', 'About SmartShop AI')}</a></li>
              <li><a href="#" className="hover:text-teal-400 transition-colors">{t('مصادر البيانات والمتاجر', 'Data Sources & Stores')}</a></li>
              <li><a href="#" className="hover:text-teal-400 transition-colors">{t('سياسة الخصوصية والنزاهة', 'Privacy Policy')}</a></li>
              <li><a href="#" className="hover:text-teal-400 transition-colors">{t('شروط الاستخدام', 'Terms of Service')}</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-white mb-3 text-sm">{t('المتاجر المدعومة في مصر', 'Egyptian Stores')}</h4>
            <div className="flex flex-wrap gap-1.5">
              {['Amazon.eg', 'Noon Egypt', 'Jumia Egypt', 'B.Tech', '2B Computer', 'Raya Shop'].map(s => (
                <span key={s} className="bg-slate-800 text-slate-300 text-[11px] px-2.5 py-1 rounded-lg border border-slate-700/80">
                  {s}
                </span>
              ))}
            </div>
          </div>

        </div>

        {/* Legal & Market Disclosures */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-500">
          <p>
            {t(
              'تنبيه: الأسعار ومصاريف الشحن وتوفر السلع خاضعة للتغيير المباشر من المتاجر البائعة. يتم تحديث البيانات دورياً مع توثيق وقت الفحص.',
              'Disclosure: Store prices, shipping conditions, and stock availability are subject to change by respective online retailers.'
            )}
          </p>
          <p className="shrink-0">
            © {new Date().getFullYear()} SmartShop AI. All rights reserved.
          </p>
        </div>

      </div>
    </footer>
  );
};

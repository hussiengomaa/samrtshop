import React, { useState } from 'react';
import { useApp } from '../context/AppContext.js';
import { Search, Sparkles, Heart, Shield, Globe, User, ArrowLeft, ArrowRight, Tag } from 'lucide-react';

export const Header: React.FC = () => {
  const { lang, setLang, currentView, setCurrentView, user, setAuthModalOpen, favorites, t } = useApp();
  const [headerQuery, setHeaderQuery] = useState('');
  const { setSearchQuery, setIsSearching, setSearchResult } = useApp();

  const handleHeaderSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!headerQuery.trim()) return;

    setSearchQuery(headerQuery);
    setCurrentView('search');
    setIsSearching(true);

    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: headerQuery })
      });
      const data = await res.json();
      setSearchResult(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-slate-900 border-b border-slate-800 text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          
          {/* Logo & Brand */}
          <div className="flex items-center gap-3 cursor-pointer select-none" onClick={() => setCurrentView('home')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-500 to-cyan-400 flex items-center justify-center text-slate-950 font-bold shadow-lg shadow-teal-500/20">
              <Tag className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-xl tracking-tight text-white">SmartShop</span>
                <span className="bg-teal-500/20 text-teal-400 border border-teal-500/30 text-xs px-2 py-0.5 rounded font-semibold">AI مصر</span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">
                {t('مقارنة الأسعار الذكية في المتاجر المصرية', 'Smart Price Comparison for Egypt')}
              </p>
            </div>
          </div>

          {/* Quick Header Search (visible on desktop) */}
          {currentView !== 'home' && (
            <form onSubmit={handleHeaderSearch} className="hidden md:flex flex-1 max-w-md mx-4 relative">
              <input
                type="text"
                value={headerQuery}
                onChange={(e) => setHeaderQuery(e.target.value)}
                placeholder={t('ابحث عن هاتف، لابتوب، جهاز منزلي...', 'Search phones, laptops, appliances...')}
                className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-4 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition-all"
              />
              <button
                type="submit"
                className="absolute inset-y-1 end-1 px-3 bg-teal-600 hover:bg-teal-500 text-slate-950 font-semibold rounded text-xs flex items-center justify-center transition-colors"
              >
                <Search className="w-3.5 h-3.5" />
              </button>
            </form>
          )}

          {/* Navigation Links */}
          <nav className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => setCurrentView('home')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                currentView === 'home'
                  ? 'bg-slate-800 text-teal-400'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              {t('الرئيسية', 'Home')}
            </button>

            <button
              onClick={() => setCurrentView('assistant')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                currentView === 'assistant'
                  ? 'bg-gradient-to-r from-teal-500/20 to-cyan-500/20 text-teal-300 border border-teal-500/40'
                  : 'text-teal-400 hover:bg-slate-800/60'
              }`}
            >
              <Sparkles className="w-4 h-4 text-teal-400" />
              <span>{t('المساعد الذكي', 'AI Assistant')}</span>
            </button>

            <button
              onClick={() => setCurrentView('favorites')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors relative ${
                currentView === 'favorites'
                  ? 'bg-slate-800 text-rose-400'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Heart className="w-4 h-4 text-rose-400 fill-rose-400/20" />
              <span className="hidden sm:inline">{t('المفضلة', 'Favorites')}</span>
              {favorites.length > 0 && (
                <span className="bg-rose-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                  {favorites.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setCurrentView('admin')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                currentView === 'admin'
                  ? 'bg-teal-950 text-teal-300 border border-teal-700'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Shield className="w-4 h-4" />
              <span className="hidden lg:inline">{t('الإدارة', 'Admin')}</span>
            </button>

            {/* Language Switcher */}
            <button
              onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-xs font-semibold text-slate-200 hover:bg-slate-700 hover:text-white transition-colors"
              title={lang === 'ar' ? 'Switch to English' : 'التحويل للعربية'}
            >
              <Globe className="w-3.5 h-3.5 text-teal-400" />
              <span>{lang === 'ar' ? 'EN' : 'عربي'}</span>
            </button>

            {/* User Profile */}
            <button
              onClick={() => setAuthModalOpen(true)}
              className="flex items-center gap-1.5 p-1.5 sm:px-3 sm:py-1.5 rounded-lg text-sm text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-xs text-teal-300 font-bold border border-slate-600">
                {user ? user.name?.charAt(0) || 'U' : <User className="w-3.5 h-3.5" />}
              </div>
              <span className="hidden md:inline text-xs font-medium text-slate-300">
                {user ? user.name?.split(' ')[0] : t('تسجيل الدخول', 'Sign In')}
              </span>
            </button>

          </nav>
        </div>
      </div>
    </header>
  );
};

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Language, UserProfile, Product, SearchResponse } from '../types/index.js';

interface AppContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  user: UserProfile | null;
  setUser: (user: UserProfile | null) => void;
  currentView: 'home' | 'search' | 'assistant' | 'favorites' | 'admin';
  setCurrentView: (view: 'home' | 'search' | 'assistant' | 'favorites' | 'admin') => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  searchResult: SearchResponse | null;
  setSearchResult: (res: SearchResponse | null) => void;
  isSearching: boolean;
  setIsSearching: (val: boolean) => void;
  selectedProductId: string | null;
  setSelectedProductId: (id: string | null) => void;
  authModalOpen: boolean;
  setAuthModalOpen: (open: boolean) => void;
  favorites: string[];
  toggleFavorite: (productId: string) => Promise<void>;
  formatPrice: (amount: number | null | undefined, currency?: string) => string;
  t: (arText: string, enText: string) => string;
}

const AppContext = createContext<AppContextType | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Language>('ar');
  const [user, setUser] = useState<UserProfile | null>({
    id: 'usr_admin_001',
    name: 'مدير المنصة / Admin',
    email: 'admin@smartshop.ai',
    role: 'admin',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });
  const [currentView, setCurrentView] = useState<'home' | 'search' | 'assistant' | 'favorites' | 'admin'>('home');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResult, setSearchResult] = useState<SearchResponse | null>(null);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);
  const [favorites, setFavorites] = useState<string[]>(['prod_iphone15pro_128']);

  // Set html direction and language when language changes
  const setLang = (newLang: Language) => {
    setLangState(newLang);
    document.documentElement.lang = newLang;
    document.documentElement.dir = newLang === 'ar' ? 'rtl' : 'ltr';
  };

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }, [lang]);

  // Load user favorites
  useEffect(() => {
    fetch('/api/favorites')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setFavorites(data.map((f: any) => f.product_id));
        }
      })
      .catch(() => {});
  }, []);

  const toggleFavorite = async (productId: string) => {
    const isFav = favorites.includes(productId);
    if (isFav) {
      setFavorites(prev => prev.filter(id => id !== productId));
      await fetch(`/api/favorites/${productId}`, { method: 'DELETE' });
    } else {
      setFavorites(prev => [...prev, productId]);
      await fetch('/api/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId })
      });
    }
  };

  const formatPrice = (amount: number | null | undefined, currency: string = 'EGP') => {
    if (amount === null || amount === undefined) {
      return lang === 'ar' ? 'غير محدد' : 'Unknown';
    }
    const formattedNum = amount.toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US');
    return lang === 'ar' ? `${formattedNum} ج.م` : `${currency} ${formattedNum}`;
  };

  const t = (arText: string, enText: string) => {
    return lang === 'ar' ? arText : enText;
  };

  return (
    <AppContext.Provider value={{
      lang,
      setLang,
      user,
      setUser,
      currentView,
      setCurrentView,
      searchQuery,
      setSearchQuery,
      searchResult,
      setSearchResult,
      isSearching,
      setIsSearching,
      selectedProductId,
      setSelectedProductId,
      authModalOpen,
      setAuthModalOpen,
      favorites,
      toggleFavorite,
      formatPrice,
      t
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};

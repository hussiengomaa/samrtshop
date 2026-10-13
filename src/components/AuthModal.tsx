import React, { useState } from 'react';
import { useApp } from '../context/AppContext.js';
import { X, User, Lock, Mail, CheckCircle2, Shield } from 'lucide-react';

export const AuthModal: React.FC = () => {
  const { authModalOpen, setAuthModalOpen, user, setUser, t } = useApp();
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!authModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';
      const body = isRegister ? { name, email, password } : { email, password };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'فشل تسجيل الدخول');
      }

      setUser(data.user);
      setAuthModalOpen(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = () => {
    setUser(null);
    setAuthModalOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
      <div className="bg-white rounded-3xl max-w-sm w-full p-6 sm:p-8 shadow-2xl border border-slate-200 text-start relative space-y-5">
        
        <button
          onClick={() => setAuthModalOpen(false)}
          className="absolute top-4 end-4 p-2 text-slate-400 hover:text-slate-600 rounded-lg"
        >
          <X className="w-4 h-4" />
        </button>

        {user ? (
          <div className="text-center space-y-4 py-2">
            <div className="w-14 h-14 bg-teal-50 border border-teal-200 text-teal-700 rounded-full flex items-center justify-center text-xl font-bold mx-auto">
              {user.name?.charAt(0) || 'U'}
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">{user.name || user.email}</h3>
              <p className="text-xs text-slate-500">{user.email}</p>
              <span className="inline-block mt-2 bg-slate-100 text-slate-700 text-[11px] font-bold px-2 py-0.5 rounded-full uppercase">
                {user.role === 'admin' ? t('مدير النظام (Admin)', 'System Admin') : t('مستخدم مسجل', 'User')}
              </span>
            </div>

            <button
              onClick={handleSignOut}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-2.5 rounded-xl text-xs transition-colors"
            >
              {t('تسجيل الخروج', 'Sign Out')}
            </button>
          </div>
        ) : (
          <>
            <div>
              <h3 className="text-lg font-black text-slate-900">
                {isRegister ? t('إنشاء حساب جديد', 'Create an Account') : t('تسجيل الدخول', 'Sign In')}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {t('لحفظ المفضلة وتتبع تنبيهات الأسعار ومتابعة المتاجر.', 'To save favorites and track price drop alerts.')}
              </p>
            </div>

            {error && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-xl">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              {isRegister && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{t('الاسم:', 'Name:')}</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute start-3 top-2.5" />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="أحمد محمد"
                      className="w-full border border-slate-300 rounded-xl ps-9 pe-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">{t('البريد الإلكتروني:', 'Email:')}</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute start-3 top-2.5" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="user@example.com"
                    className="w-full border border-slate-300 rounded-xl ps-9 pe-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">{t('كلمة المرور:', 'Password:')}</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute start-3 top-2.5" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="w-full border border-slate-300 rounded-xl ps-9 pe-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-slate-900 hover:bg-teal-700 text-white font-bold py-2.5 rounded-xl text-xs transition-colors flex items-center justify-center gap-2 mt-2 shadow-xs"
              >
                {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : null}
                <span>{isRegister ? t('إنشاء الحساب', 'Create Account') : t('دخول', 'Sign In')}</span>
              </button>
            </form>

            <div className="text-center pt-2 border-t border-slate-100">
              <button
                onClick={() => {
                  setIsRegister(!isRegister);
                  setError(null);
                }}
                className="text-xs text-teal-700 hover:underline font-bold"
              >
                {isRegister
                  ? t('لديك حساب بالفعل؟ سجل دخولك', 'Already have an account? Sign in')
                  : t('ليس لديك حساب؟ سجل حساباً جديداً', "Don't have an account? Sign up")}
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  );
};

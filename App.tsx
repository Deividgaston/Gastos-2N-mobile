import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { auth, db } from './firebase-init';
import { collection, query, where, getDocs, limit, addDoc } from 'firebase/firestore';
import Home from './pages/Home';
import Mileage from './pages/Mileage';
import Summary from './pages/Summary';
import Admin from './pages/Admin';
import { User } from './types';
import { LogOut, LogIn, LayoutDashboard, Car, BarChart3, ShieldCheck } from 'lucide-react';
import { translations, Language } from './utils/translations';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [lang, setLang] = useState<Language>('ES');
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (u) {
        setUser({ uid: u.uid, email: u.email || '' });
      } else {
        setUser(null);
        setIsAuthorized(null);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const checkAuthorization = async () => {
      if (!user || !user.email) return;

      try {
        // --- EMERGENCY BYPASS FOR OWNER ---
        if (user.email.toLowerCase() === 'gastonortigosa@gmail.com') {
          setUser(prev => prev ? { ...prev, isAdmin: true, isWhitelisted: true } : null);
          setIsAuthorized(true);
          setLoading(false);
          return;
        }

        // 1. Check if ANY user exists (Bootstrap check)
        const qAll = query(collection(db, 'whitelisted_users'), limit(1));
        const allSnap = await getDocs(qAll);

        if (allSnap.empty) {
          // Initialize first user as admin
          await addDoc(collection(db, 'whitelisted_users'), {
            email: user.email.toLowerCase(),
            isAdmin: true,
            isWhitelisted: true,
            createdAt: new Date()
          });
          setUser(prev => prev ? { ...prev, isAdmin: true, isWhitelisted: true } : null);
          setIsAuthorized(true);
          setLoading(false);
          return;
        }

        // 2. Check current user
        const q = query(
          collection(db, 'whitelisted_users'),
          where('email', '==', user.email.toLowerCase()),
          limit(1)
        );
        const snap = await getDocs(q);

        if (!snap.empty) {
          const data = snap.docs[0].data();
          setUser(prev => prev ? {
            ...prev,
            isAdmin: data.isAdmin,
            isWhitelisted: data.isWhitelisted
          } : null);
          setIsAuthorized(true);
        } else {
          setIsAuthorized(false);
        }
      } catch (err: any) {
        console.error("Auth check error:", err);
        // If it's a permission error, it might be because the collection is empty but rules block reading it
        // and we can't bootstrap. For now, assume unauthorized but alert the error.
        if (err.code === 'permission-denied') {
          console.warn("Permission denied. Ensure Firestore rules allow initial read/write or collection exists.");
        }
        setIsAuthorized(false);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      checkAuthorization();
    }
  }, [user]);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      alert('Error login: ' + (err.message || ''));
    }
  };

  const handleLogout = () => signOut(auth);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const t = translations[lang];

  // Unauthorized view
  if (user && isAuthorized === false) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-8 text-center space-y-6">
        <div className="bg-red-50 p-6 rounded-full text-red-500 animate-pulse">
          <ShieldCheck size={48} strokeWidth={1.5} />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black text-slate-900">Access Restricted</h2>
          <p className="text-slate-500 max-w-xs mx-auto text-sm font-medium">
            Your account ({user.email}) is not authorized. Please ask an administrator to whitelist your email via WhatsApp.
          </p>
        </div>
        <button onClick={handleLogout} className="text-blue-600 font-black text-xs uppercase tracking-widest bg-white px-6 py-3 rounded-xl border border-slate-200 shadow-sm">
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <Router>
      <div className="min-h-screen flex flex-col bg-slate-50">
        {/* TOP BAR */}
        <header className="sticky top-0 z-40 glass-nav shadow-sm">
          <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2 md:gap-8">
              <Link to="/" className="flex items-center gap-3 group">
                <div className="bg-slate-900 rounded-xl group-hover:bg-blue-600 transition-all duration-300 shadow-lg overflow-hidden flex items-center justify-center w-10 h-10">
                  <img src="logo.png" alt="2N Logo" className="w-8 h-8 object-contain" />
                </div>
                <h1 className="hidden sm:block font-extrabold text-slate-800 tracking-tight text-lg">Gastos 2N</h1>
              </Link>

              <nav className="flex items-center gap-1">
                <NavLinks t={t} user={user} />
              </nav>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 mr-2">
                {(['ES', 'EN', 'PT'] as Language[]).map(l => (
                  <button
                    key={l}
                    onClick={() => setLang(l)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${lang === l ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    {l}
                  </button>
                ))}
              </div>

              {user ? (
                <div className="flex items-center gap-3">
                  <span className="hidden lg:inline text-[10px] font-black uppercase tracking-widest text-slate-400 bg-white/50 px-3 py-1.5 rounded-full border border-slate-200">
                    {user.email}
                  </span>
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 text-sm font-bold text-red-500 hover:bg-red-50 px-4 py-2 rounded-xl transition-all active:scale-95"
                    title={t.nav.logout}
                  >
                    <LogOut size={16} />
                    <span className="hidden sm:inline">{t.nav.logout}</span>
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleLogin}
                  className="btn-premium btn-premium-primary text-sm"
                >
                  <LogIn size={18} />
                  <span>{t.nav.login}</span>
                </button>
              )}
            </div>
          </div>
        </header>

        {/* CONTENT */}
        <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-8">
          <Routes>
            <Route path="/" element={<Home user={user} lang={lang} />} />
            <Route path="/kms" element={<Mileage user={user} lang={lang} />} />
            <Route path="/summary" element={<Summary user={user} lang={lang} />} />
            <Route path="/admin" element={user?.isAdmin ? <Admin /> : <Home user={user} lang={lang} />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
};

const NavLinks: React.FC<{ t: any; user: User | null }> = ({ t, user }) => {
  const location = useLocation();
  const linkClass = (path: string) => `
    flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200
    ${location.pathname === path
      ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
      : 'text-slate-500 hover:bg-slate-100/50 hover:text-slate-900'}
  `;

  return (
    <>
      <Link to="/" className={linkClass('/')}>
        <LayoutDashboard size={18} />
        <span className="hidden sm:inline">{t.nav.expenses}</span>
      </Link>
      <Link to="/kms" className={linkClass('/kms')}>
        <Car size={18} />
        <span className="hidden sm:inline">{t.nav.mileage}</span>
      </Link>
      <Link to="/summary" className={linkClass('/summary')}>
        <BarChart3 size={18} />
        <span className="hidden sm:inline">{t.nav.summary}</span>
      </Link>
      {user?.isAdmin && (
        <Link to="/admin" className={`${linkClass('/admin')} hidden lg:flex`}>
          <ShieldCheck size={18} />
          <span className="hidden sm:inline">Admin</span>
        </Link>
      )}
    </>
  );
};

export default App;




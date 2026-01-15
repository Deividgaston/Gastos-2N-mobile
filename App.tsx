import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from './firebase-init';
import { collection, query, where, getDocs, limit, addDoc } from 'firebase/firestore';
import Home from './pages/Home';
import Mileage from './pages/Mileage';
import Summary from './pages/Summary';
import Admin from './pages/Admin';
import { User } from './types';
import { LogOut, LogIn, LayoutDashboard, Car, BarChart3, ShieldCheck, Mail } from 'lucide-react';
import { translations, Language } from './utils/translations';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [lang, setLang] = useState<Language>('ES');
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [showEmailLogin, setShowEmailLogin] = useState(false);
  const [isInvited, setIsInvited] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('auth') === 'email') {
      setShowEmailLogin(true);
      setIsRegistering(true); // Default to registration since they're new
    }
    if (params.get('auth') === 'invite') {
      setIsInvited(true);
      setIsRegistering(true); // Default to registration since they're new
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      console.log("onAuthStateChanged:", u ? u.email : "null");
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
      if (!user || !user.email) {
        return;
      }

      // If we already checked and have the flags, don't check again
      if (user.isAdmin !== undefined && user.isWhitelisted !== undefined) {
        return;
      }

      try {
        console.log("Checking authorization for:", user.email);
        // --- EMERGENCY BYPASS FOR OWNER ---
        if (user.email.toLowerCase() === 'gastonortigosa@gmail.com') {
          console.log("Owner bypass triggered");
          setUser(prev => (prev && !prev.isAdmin) ? { ...prev, isAdmin: true, isWhitelisted: true } : prev);
          setIsAuthorized(true);
          setLoading(false);
          return;
        }

        // 1. Check if ANY user exists (Bootstrap check)
        const qAll = query(collection(db, 'whitelisted_users'), limit(1));
        const allSnap = await getDocs(qAll);

        if (allSnap.empty) {
          console.log("Bootstrapping first user...");
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
        console.error("Auth check error in App.tsx:", err);
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
      setLoading(true);
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      setLoading(false);
      if (err.code !== 'auth/popup-closed-by-user') {
        alert('Error login: ' + (err.message || ''));
      }
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !password) return alert('Email & Password required');
    if (!cleanEmail.includes('@')) return alert('Invalid email format');
    if (password.length < 6) return alert('Password must be at least 6 characters');

    try {
      console.log("Starting email auth...", { cleanEmail, isRegistering });
      setLoading(true);
      if (isRegistering) {
        const res = await createUserWithEmailAndPassword(auth, cleanEmail, password);
        console.log("User created successfully:", res.user.email);
      } else {
        const res = await signInWithEmailAndPassword(auth, cleanEmail, password);
        console.log("User signed in successfully:", res.user.email);
      }
    } catch (err: any) {
      console.error("Auth error:", err);
      let msg = err.message;
      if (err.code === 'auth/invalid-email') msg = "El formato del email no es válido. Revisa que no haya espacios al final.";
      if (err.code === 'auth/email-already-in-use') {
        msg = "Este correo ya está registrado. Te hemos cambiado al modo 'Iniciar Sesión'. Introduce tu contraseña.";
        setIsRegistering(false); // Auto-switch to login
      }
      if (err.code === 'auth/weak-password') msg = "La contraseña es muy débil. Usa al menos 6 caracteres.";

      alert('Error de Autenticación: ' + msg);
      setLoading(false);
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

  // Login view
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-fixed">
        <div className="w-full max-w-md space-y-8 animate-fade-in">
          <div className="text-center space-y-4">
            <div className="inline-flex bg-slate-900 p-4 rounded-3xl shadow-2xl mb-4">
              <img src="logo.png" alt="2N Logo" className="w-16 h-16 object-contain" />
            </div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Gastos 2N</h2>
            <p className="text-slate-500 font-medium tracking-wide uppercase text-[10px]">Cloud Expenses Management System</p>
          </div>

          <div className="premium-card p-8 space-y-6">
            {isInvited && (
              <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl flex items-center gap-3 animate-slide-up">
                <div className="bg-blue-600 text-white p-2 rounded-xl">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-blue-600 tracking-widest">¡Bienvenido!</p>
                  <p className="text-xs font-bold text-slate-700">Tu correo ya ha sido autorizado.</p>
                </div>
              </div>
            )}

            {!showEmailLogin ? (
              <div className="space-y-4">
                <button
                  onClick={handleLogin}
                  className="w-full btn-premium py-4 bg-white border border-slate-200 text-slate-900 hover:bg-slate-50 flex items-center justify-center gap-3"
                >
                  <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
                  <span className="font-bold">Continue with Google</span>
                </button>

                <div className="relative py-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-100"></div>
                  </div>
                  <div className="relative flex justify-center text-xs uppercase text-slate-400 font-black">
                    <span className="bg-white px-4">OR</span>
                  </div>
                </div>

                <button
                  onClick={() => setShowEmailLogin(true)}
                  className="w-full btn-premium py-4 bg-slate-900 text-white hover:bg-slate-800 flex items-center justify-center gap-3 shadow-xl"
                >
                  <Mail size={20} />
                  <span className="font-bold">Use Email & Password</span>
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                <form onSubmit={handleEmailAuth} className="space-y-4 animate-slide-up">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Email Address</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="name@company.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-1">
                      {isRegistering ? 'Choose your password' : 'Password'}
                    </label>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="••••••••"
                    />
                    {isRegistering && (
                      <p className="text-[9px] text-slate-400 ml-1 font-medium italic">Min. 6 characters</p>
                    )}
                  </div>

                  <button
                    type="submit"
                    className="w-full btn-premium py-4 bg-blue-600 text-white hover:bg-blue-500 shadow-xl shadow-blue-200"
                  >
                    <span className="font-bold">
                      {isRegistering ? 'Set Password & Access' : 'Sign In Now'}
                    </span>
                  </button>

                  <div className="flex flex-col gap-3 pt-4 border-t border-slate-100 text-center">
                    <button
                      type="button"
                      onClick={() => setIsRegistering(!isRegistering)}
                      className="text-xs font-black text-blue-600 uppercase tracking-widest"
                    >
                      {isRegistering ? 'Already have an account? Log In' : 'Need an account? Register'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowEmailLogin(false)}
                      className="text-xs font-bold text-slate-400"
                    >
                      Go back to Google login
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>

          <p className="text-center text-[10px] text-slate-400 font-medium">
            Protected by Gastos 2N Security Whitelist System
          </p>
        </div>
      </div>
    );
  }

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




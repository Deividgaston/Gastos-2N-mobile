
import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import Mileage from './pages/Mileage';
import Export from './pages/Export';
import Summary from './pages/Summary';
import { User } from './types';

// Firebase Config from User's Snippet
const FBCONFIG = {
  apiKey: "AIzaSyBTK8altmAR-fWqR9BjE74gEGavuiqk1Bs",
  authDomain: "gastos-2n.firebaseapp.com",
  projectId: "gastos-2n",
  storageBucket: "gastos-2n.firebasestorage.app",
  messagingSenderId: "55010048795",
  appId: "1:55010048795:web:4fb48d1e0f9006ebf7b1be"
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fixed window.firebase by casting to any
    if (!(window as any).firebase.apps.length) {
      (window as any).firebase.initializeApp(FBCONFIG);
    }
    const auth = (window as any).firebase.auth();
    const unsubscribe = auth.onAuthStateChanged((u: any) => {
      if (u) {
        setUser({ uid: u.uid, email: u.email });
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = () => {
    // Fixed window.firebase.auth.GoogleAuthProvider by casting to any
    const provider = new (window as any).firebase.auth.GoogleAuthProvider();
    (window as any).firebase.auth().signInWithPopup(provider).catch((err: any) => {
      if (err.code === 'auth/popup-blocked' || err.code === 'auth/popup-closed-by-user') {
        (window as any).firebase.auth().signInWithRedirect(provider);
      } else {
        alert('Error login: ' + (err.message || ''));
      }
    });
  };

  const handleLogout = () => {
    // Fixed window.firebase by casting to any
    (window as any).firebase.auth().signOut();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <Router>
      <div className="min-h-screen flex flex-col">
        {/* TOP BAR */}
        <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2 md:gap-4">
              <Link to="/" className="flex items-center gap-2 group">
                <div className="bg-slate-900 text-white p-1.5 rounded-lg group-hover:bg-blue-600 transition-colors">
                  <span className="font-bold text-sm tracking-tighter">2N</span>
                </div>
                <h1 className="hidden sm:block font-bold text-slate-800 tracking-tight">Gastos 2N</h1>
              </Link>
              
              <nav className="hidden md:flex items-center gap-1 ml-4">
                <NavLinks />
              </nav>
            </div>

            <div className="flex items-center gap-3">
              {user ? (
                <div className="flex items-center gap-3">
                  <span className="hidden lg:inline text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200" id="whoami">
                    {user.email}
                  </span>
                  <button 
                    onClick={handleLogout} 
                    id="btnLogout"
                    className="flex items-center gap-2 text-sm font-semibold text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg transition-colors"
                  >
                    <i className="fa-solid fa-right-from-bracket"></i>
                    <span className="hidden sm:inline">Salir</span>
                  </button>
                </div>
              ) : (
                <button 
                  onClick={handleLogin} 
                  id="btnLogin"
                  className="bg-blue-600 text-white text-sm font-bold px-4 py-2 rounded-lg shadow-sm hover:bg-blue-700 active:transform active:scale-95 transition-all flex items-center gap-2"
                >
                  <i className="fa-brands fa-google"></i>
                  <span>Login</span>
                </button>
              )}
            </div>
          </div>
          
          {/* MOBILE NAV */}
          <div className="md:hidden flex items-center justify-around border-t border-slate-100 py-2">
            <NavLinks />
          </div>
        </header>

        {/* CONTENT */}
        <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6 lg:p-8">
          <Routes>
            <Route path="/" element={<Home user={user} />} />
            <Route path="/kms" element={<Mileage user={user} />} />
            <Route path="/export" element={<Export user={user} />} />
            <Route path="/summary" element={<Summary user={user} />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
};

const NavLinks: React.FC = () => {
  const location = useLocation();
  const linkClass = (path: string) => `
    flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-all
    ${location.pathname === path 
      ? 'bg-blue-50 text-blue-700 shadow-sm border border-blue-100' 
      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}
  `;

  return (
    <>
      <Link to="/" className={linkClass('/')}>
        <i className="fa-solid fa-house"></i>
        <span>Inicio</span>
      </Link>
      <Link to="/kms" className={linkClass('/kms')}>
        <i className="fa-solid fa-car"></i>
        <span>KM</span>
      </Link>
      <Link to="/export" className={linkClass('/export')}>
        <i className="fa-solid fa-file-export"></i>
        <span>Export</span>
      </Link>
      <Link to="/summary" className={linkClass('/summary')}>
        <i className="fa-solid fa-chart-simple"></i>
        <span>Summary</span>
      </Link>
    </>
  );
};

export default App;

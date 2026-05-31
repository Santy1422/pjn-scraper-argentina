import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Expedientes from './components/Expedientes';
import ExpedienteDetalle from './components/ExpedienteDetalle';
import Actividad from './components/Actividad';
import Alertas from './components/Alertas';
import Favoritos from './components/Favoritos';
import Stats from './components/Stats';
import Calendario from './components/Calendario';
import Configuracion from './components/Configuracion';
import SearchOverlay from './components/SearchOverlay';
import Login from './components/Login';
import { api, auth } from './api';

const ToastCtx = createContext();
export function useToast() { return useContext(ToastCtx); }

function ToastContainer({ toasts, remove }) {
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type}`} onClick={() => remove(t.id)}>
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const [authState, setAuthState] = useState('loading'); // loading, login, setup, authenticated
  const [user, setUser] = useState(null);
  const [page, setPage] = useState('dashboard');
  const [detailId, setDetailId] = useState(null);
  const [scraping, setScraping] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [badges, setBadges] = useState({});

  const toast = useCallback((message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Check auth on load
  useEffect(() => {
    auth.status().then(status => {
      if (status.needsSetup) setAuthState('setup');
      else if (status.authenticated) { setUser(status.user); setAuthState('authenticated'); }
      else setAuthState('login');
    }).catch(() => setAuthState('login'));
  }, []);

  // Listen for unauthorized events
  useEffect(() => {
    function handleUnauth() {
      auth.setToken(null);
      setAuthState('login');
      setUser(null);
    }
    window.addEventListener('betti:unauthorized', handleUnauth);
    return () => window.removeEventListener('betti:unauthorized', handleUnauth);
  }, []);

  const openExpediente = useCallback((id) => {
    setDetailId(id);
    setPage('detalle');
  }, []);

  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearch(s => !s);
      }
      if (e.key === 'Escape') setShowSearch(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  async function handleScrape() {
    setScraping(true);
    toast('Sincronizando con PJN...', 'info');
    try {
      const result = await api.scrape();
      if (result.needsConfig) {
        toast('Configura tus credenciales PJN primero', 'error');
        setPage('configuracion');
      } else if (result.ok) {
        toast('Sincronizacion completada', 'success');
      } else {
        toast('Error: ' + (result.error || 'desconocido'), 'error');
      }
    } catch (e) {
      toast('Error: ' + e.message, 'error');
    }
    setScraping(false);
  }

  function handleAuth(u) {
    setUser(u);
    setAuthState('authenticated');
  }

  function handleLogout() {
    setAuthState('login');
    setUser(null);
    setPage('dashboard');
  }

  // Loading state
  if (authState === 'loading') {
    return (
      <div className="login-page">
        <div className="login-card" style={{ textAlign: 'center', padding: 40 }}>
          <div className="brand-icon" style={{ margin: '0 auto 12px', width: 40, height: 40 }}>
            <svg className="spinning" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="white" strokeWidth="2"><path d="M21 12a9 9 0 11-6.219-8.56" /></svg>
          </div>
          <p style={{ color: 'var(--text3)', fontSize: 13 }}>Cargando...</p>
        </div>
      </div>
    );
  }

  // Login/Setup
  if (authState === 'login' || authState === 'setup') {
    return (
      <>
        <Login needsSetup={authState === 'setup'} onAuth={handleAuth} />
        <ToastContainer toasts={toasts} remove={removeToast} />
      </>
    );
  }

  function renderPage() {
    switch (page) {
      case 'dashboard': return <Dashboard setPage={setPage} openExpediente={openExpediente} />;
      case 'expedientes': return <Expedientes setPage={setPage} openExpediente={openExpediente} />;
      case 'detalle': return <ExpedienteDetalle id={detailId} setPage={setPage} openExpediente={openExpediente} />;
      case 'actividad': return <Actividad setPage={setPage} openExpediente={openExpediente} />;
      case 'alertas': return <Alertas setPage={setPage} openExpediente={openExpediente} />;
      case 'favoritos': return <Favoritos setPage={setPage} openExpediente={openExpediente} />;
      case 'calendario': return <Calendario openExpediente={openExpediente} />;
      case 'stats': return <Stats />;
      case 'configuracion': return <Configuracion user={user} onLogout={handleLogout} />;
      default: return <Dashboard setPage={setPage} openExpediente={openExpediente} />;
    }
  }

  return (
    <ToastCtx.Provider value={toast}>
      <div className="app">
        <Sidebar
          page={page} setPage={setPage}
          onScrape={handleScrape} scraping={scraping}
          onSearch={() => setShowSearch(true)}
          badges={badges}
          user={user}
        />
        <main className="main">
          {renderPage()}
        </main>
        {showSearch && (
          <SearchOverlay
            onClose={() => setShowSearch(false)}
            onSelect={(id) => { openExpediente(id); setShowSearch(false); }}
          />
        )}
        <ToastContainer toasts={toasts} remove={removeToast} />
      </div>
    </ToastCtx.Provider>
  );
}

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
  const [refreshKey, setRefreshKey] = useState(0);
  const [showSearch, setShowSearch] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [badges, setBadges] = useState({});
  const [installPrompt, setInstallPrompt] = useState(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  const toast = useCallback((message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // PWA install prompt
  useEffect(() => {
    const dismissed = sessionStorage.getItem('pwa-dismissed');
    if (dismissed) return;
    function handleBIP(e) {
      e.preventDefault();
      setInstallPrompt(e);
      setShowInstallBanner(true);
    }
    window.addEventListener('beforeinstallprompt', handleBIP);
    return () => window.removeEventListener('beforeinstallprompt', handleBIP);
  }, []);

  async function handleInstall() {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') toast('App instalada', 'success');
    setShowInstallBanner(false);
    setInstallPrompt(null);
  }

  function dismissInstall() {
    setShowInstallBanner(false);
    sessionStorage.setItem('pwa-dismissed', '1');
  }

  // Check auth on load
  useEffect(() => {
    auth.status().then(status => {
      if (status.authenticated) { setUser(status.user); setAuthState('authenticated'); }
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
    try {
      const result = await api.scrape();
      if (result.needsConfig) {
        toast('Configura tus credenciales PJN primero', 'error');
        setPage('configuracion');
        setScraping(false);
        return;
      }
      if (!result.ok) {
        toast('Error: ' + (result.error || 'desconocido'), 'error');
        setScraping(false);
        return;
      }
      if (result.started === false && result.running) {
        toast('Ya hay una sincronizacion en curso...', 'info');
      } else {
        toast('Sincronizando con PJN (puede tardar unos minutos)...', 'info');
      }
      // El scrape corre en background: esperamos a que termine haciendo polling
      await pollSync();
    } catch (e) {
      toast('Error: ' + e.message, 'error');
      setScraping(false);
    }
  }

  async function pollSync() {
    const MAX_MS = 12 * 60 * 1000; // 12 min de margen
    const start = Date.now();
    while (Date.now() - start < MAX_MS) {
      await new Promise(r => setTimeout(r, 4000));
      let s;
      try { s = await api.syncStatus(); } catch { continue; }
      if (!s.running) {
        if (s.lastError) {
          toast('Error en la sincronizacion: ' + s.lastError, 'error');
        } else {
          toast('Sincronizacion completada', 'success');
          setRefreshKey(k => k + 1); // refrescar home con los datos nuevos
        }
        setScraping(false);
        return;
      }
    }
    toast('La sincronizacion sigue corriendo en segundo plano', 'info');
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

  // Login
  if (authState === 'login') {
    return (
      <>
        <Login onAuth={handleAuth} />
        <ToastContainer toasts={toasts} remove={removeToast} />
      </>
    );
  }

  function renderPage() {
    switch (page) {
      case 'dashboard': return <Dashboard key={refreshKey} setPage={setPage} openExpediente={openExpediente} />;
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
        {showInstallBanner && (
          <div className="install-banner">
            <span>Instala Betti en tu dispositivo para acceso rapido</span>
            <div className="install-banner-actions">
              <button className="btn btn-sm" onClick={dismissInstall}>Ahora no</button>
              <button className="btn btn-sm btn-primary" onClick={handleInstall}>Instalar</button>
            </div>
          </div>
        )}
      </div>
    </ToastCtx.Provider>
  );
}

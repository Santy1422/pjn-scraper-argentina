import { useEffect, useState } from 'react';
import { Home, FolderOpen, Star, RefreshCw, Search, Settings, Scale } from 'lucide-react';
import { api } from '../api';

const NAV = [
  { id: 'dashboard', label: 'Inicio', icon: Home },
  { id: 'expedientes', label: 'Expedientes', icon: FolderOpen },
  { id: 'favoritos', label: 'Favoritos', icon: Star },
];

export default function Sidebar({ page, setPage, onScrape, scraping, onSearch, badges = {}, user }) {
  const [sync, setSync] = useState(null);

  useEffect(() => {
    api.syncStatus().then(setSync).catch(() => {});
  }, []);

  function timeSince(ts) {
    if (!ts) return 'nunca';
    const diff = Date.now() - new Date(ts + 'Z').getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'ahora';
    if (mins < 60) return `hace ${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `hace ${hrs}h`;
    return `hace ${Math.floor(hrs / 24)}d`;
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-brand" onClick={() => setPage('dashboard')} style={{ cursor: 'pointer' }}>
        <div className="brand-icon"><Scale size={18} /></div>
        <div className="nav-label">
          <div className="brand-name">Betti</div>
          <div className="brand-sub">PJN Scraper Argentina</div>
        </div>
      </div>

      <button className="search-trigger" onClick={onSearch}>
        <Search size={14} />
        <span className="nav-label">Buscar expediente...</span>
        <kbd className="nav-label">⌘K</kbd>
      </button>

      <nav>
        {NAV.map(({ id, label, icon: Icon, badgeKey }) => (
          <button key={id} className={page === id ? 'active' : ''} onClick={() => setPage(id)}>
            <Icon size={17} />
            <span className="nav-label">{label}</span>
            {badgeKey && badges[badgeKey] > 0 && (
              <span className="nav-badge">{badges[badgeKey]}</span>
            )}
          </button>
        ))}

        <div className="nav-divider" />

        <button className={page === 'configuracion' ? 'active' : ''} onClick={() => setPage('configuracion')}>
          <Settings size={17} />
          <span className="nav-label">Configuracion</span>
        </button>
      </nav>

      <div className="sidebar-footer">
        {user && (
          <div className="sidebar-user nav-label" onClick={() => setPage('configuracion')} style={{ cursor: 'pointer' }}>
            <div className="sidebar-user-avatar">{user.nombre?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase()}</div>
            <span className="sidebar-user-name">{user.nombre || user.email}</span>
          </div>
        )}
        <div className="sync-info nav-label">
          <span className={`sync-dot ${scraping ? 'syncing' : ''}`} />
          Ult. sync: {scraping ? 'en curso...' : sync?.timestamp ? timeSince(sync.timestamp) : 'nunca'}
        </div>
        <button onClick={onScrape} disabled={scraping}>
          <RefreshCw size={14} className={scraping ? 'spinning' : ''} />
          <span className="nav-label">{scraping ? 'Sincronizando...' : 'Sincronizar PJN'}</span>
        </button>
      </div>
    </aside>
  );
}

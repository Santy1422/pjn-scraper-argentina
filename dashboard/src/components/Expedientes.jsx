import { useEffect, useState } from 'react';
import { api } from '../api';
import { FolderOpen, Search, X } from 'lucide-react';
import { badgeClass } from '../utils';

export default function Expedientes({ setPage, openExpediente }) {
  const [expedientes, setExpedientes] = useState([]);
  const [filtros, setFiltros] = useState({ q: '', jurisdiccion: '', situacion: '', anio: '' });
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState('updated_at');
  const [sortDir, setSortDir] = useState('desc');

  useEffect(() => { loadExpedientes(); }, []);

  // Auto-search on filter dropdown change
  useEffect(() => {
    if (filtros.jurisdiccion || filtros.situacion || filtros.anio) {
      loadExpedientes();
    }
  }, [filtros.jurisdiccion, filtros.situacion, filtros.anio]);

  async function loadExpedientes() {
    setLoading(true);
    const hasFilters = filtros.q || filtros.jurisdiccion || filtros.situacion || filtros.anio;
    let data;
    if (hasFilters) {
      const params = {};
      if (filtros.q) params.q = filtros.q;
      if (filtros.jurisdiccion) params.jurisdiccion = filtros.jurisdiccion;
      if (filtros.situacion) params.situacion = filtros.situacion;
      if (filtros.anio) params.anio = filtros.anio;
      data = await api.filtrar(params);
    } else {
      data = await api.expedientes();
    }
    setExpedientes(data);
    setLoading(false);
  }

  function handleSearch(e) {
    e.preventDefault();
    loadExpedientes();
  }

  function clearFilters() {
    setFiltros({ q: '', jurisdiccion: '', situacion: '', anio: '' });
    api.expedientes().then(d => { setExpedientes(d); });
  }

  function toggleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }

  const sorted = [...expedientes].sort((a, b) => {
    let va = a[sortKey] || '', vb = b[sortKey] || '';
    if (typeof va === 'string') va = va.toLowerCase();
    if (typeof vb === 'string') vb = vb.toLowerCase();
    if (va < vb) return sortDir === 'asc' ? -1 : 1;
    if (va > vb) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const hasFilters = filtros.q || filtros.jurisdiccion || filtros.situacion || filtros.anio;

  // Keyboard: Enter to search, Escape to clear
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape' && hasFilters) {
        clearFilters();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hasFilters]);

  return (
    <div className="fade-in">
      <h2 className="page-title"><FolderOpen size={22} /> Expedientes</h2>

      <form className="search-bar" onSubmit={handleSearch}>
        <input
          placeholder="Buscar por carátula o clave..."
          value={filtros.q}
          onChange={e => setFiltros({ ...filtros, q: e.target.value })}
        />
        <select value={filtros.jurisdiccion} onChange={e => { setFiltros({ ...filtros, jurisdiccion: e.target.value }); }}>
          <option value="">Jurisdicción</option>
          <option value="CNT">CNT - Trabajo</option>
          <option value="CIV">CIV - Civil</option>
          <option value="COM">COM - Comercial</option>
          <option value="CAF">CAF - Cont. Admin.</option>
          <option value="CSS">CSS - Seg. Social</option>
          <option value="CCF">CCF - Civil y Com. Fed.</option>
        </select>
        <select value={filtros.situacion} onChange={e => setFiltros({ ...filtros, situacion: e.target.value })}>
          <option value="">Situación</option>
          <option value="EN LETRA">En Letra</option>
          <option value="EN DESPACHO">En Despacho</option>
          <option value="GIRO">Giro</option>
          <option value="ACUMULADO">Acumulado</option>
          <option value="ARCHIVO PROVISORIO">Archivo Provisorio</option>
        </select>
        <select value={filtros.anio} onChange={e => setFiltros({ ...filtros, anio: e.target.value })}>
          <option value="">Año</option>
          {Array.from({ length: 14 }, (_, i) => 2026 - i).map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <button type="submit" className="btn-primary">
          <Search size={14} /> Buscar
        </button>
        {hasFilters && (
          <button type="button" className="btn-ghost" onClick={clearFilters}>
            <X size={14} /> Limpiar
          </button>
        )}
      </form>

      {loading ? (
        <div className="panel">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton-row">
              <div className="skeleton skeleton-bar" style={{ width: 120 }} />
              <div className="skeleton skeleton-bar" style={{ flex: 1 }} />
              <div className="skeleton skeleton-bar" style={{ width: 80 }} />
              <div className="skeleton skeleton-bar" style={{ width: 140 }} />
              <div className="skeleton skeleton-bar" style={{ width: 80 }} />
            </div>
          ))}
        </div>
      ) : (
        <>
          <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12 }}>
            {sorted.length} expedientes {hasFilters ? '(filtrado)' : ''}
          </p>
          <div className="panel">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th className="sortable" onClick={() => toggleSort('clave')}>
                      Clave {sortKey === 'clave' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                    </th>
                    <th className="sortable" onClick={() => toggleSort('caratula')}>
                      Carátula {sortKey === 'caratula' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                    </th>
                    <th className="sortable" onClick={() => toggleSort('situacion')}>
                      Situación {sortKey === 'situacion' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                    </th>
                    <th>Dependencia</th>
                    <th className="sortable" onClick={() => toggleSort('ultima_actuacion')}>
                      Última Act. {sortKey === 'ultima_actuacion' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map(exp => (
                    <tr key={exp.id} className="clickable-row" onClick={() => openExpediente(exp.id)}>
                      <td style={{ color: 'var(--accent2)', fontWeight: 500 }}>{exp.clave}</td>
                      <td title={exp.caratula} style={{ maxWidth: 280 }}>{exp.caratula}</td>
                      <td><span className={badgeClass(exp.situacion)}>{exp.situacion || '—'}</span></td>
                      <td title={exp.dependencia}>{exp.dependencia?.substring(0, 35)}</td>
                      <td>{exp.ultima_actuacion || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { api } from '../api';
import { AlertTriangle, Clock } from 'lucide-react';
import { badgeClass } from '../utils';

export default function Alertas({ setPage, openExpediente }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.alertas().then(setData);
  }, []);

  if (!data) return (
    <div className="fade-in">
      <h2 className="page-title"><AlertTriangle size={22} /> Alertas</h2>
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(2,1fr)' }}>
        <div className="skeleton skeleton-card" />
        <div className="skeleton skeleton-card" />
      </div>
      <div className="panel">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="skeleton-row">
            <div className="skeleton skeleton-bar" style={{ width: 120 }} />
            <div className="skeleton skeleton-bar" style={{ flex: 1 }} />
            <div className="skeleton skeleton-bar" style={{ width: 80 }} />
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="fade-in">
      <h2 className="page-title"><AlertTriangle size={22} /> Alertas</h2>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: 20 }}>
        <div className="stat-card red">
          <div className="label">Total alertas</div>
          <div className="value">{data.total}</div>
        </div>
        <div className="stat-card red">
          <div className="label">En Despacho</div>
          <div className="value">{data.en_despacho.length}</div>
        </div>
        <div className="stat-card yellow">
          <div className="label">En Giro</div>
          <div className="value">{data.en_giro.length}</div>
        </div>
      </div>

      {data.en_despacho.length > 0 && (
        <div className="panel">
          <div className="panel-header">
            <h3><span className="badge despacho">EN DESPACHO</span> — {data.en_despacho.length} expedientes</h3>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Clave</th><th>Carátula</th><th>Dependencia</th><th>Última Act.</th></tr></thead>
              <tbody>
                {data.en_despacho.map(exp => (
                  <tr key={exp.id} className="clickable-row" onClick={() => openExpediente(exp.id)}>
                    <td style={{ color: 'var(--accent2)', fontWeight: 500 }}>{exp.clave}</td>
                    <td title={exp.caratula}>{exp.caratula?.substring(0, 50)}</td>
                    <td>{exp.dependencia?.substring(0, 35)}</td>
                    <td>{exp.ultima_actuacion || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {data.en_giro.length > 0 && (
        <div className="panel">
          <div className="panel-header">
            <h3><span className="badge giro">GIRO</span> — {data.en_giro.length} expedientes</h3>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Clave</th><th>Carátula</th><th>Dependencia</th><th>Última Act.</th></tr></thead>
              <tbody>
                {data.en_giro.map(exp => (
                  <tr key={exp.id} className="clickable-row" onClick={() => openExpediente(exp.id)}>
                    <td style={{ color: 'var(--accent2)', fontWeight: 500 }}>{exp.clave}</td>
                    <td title={exp.caratula}>{exp.caratula?.substring(0, 50)}</td>
                    <td>{exp.dependencia?.substring(0, 35)}</td>
                    <td>{exp.ultima_actuacion || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {data.total === 0 && (
        <div className="panel">
          <div className="empty-state" style={{ padding: 40 }}>
            <AlertTriangle size={32} style={{ color: 'var(--green)', marginBottom: 12 }} />
            <p>Sin alertas activas.</p>
            <p style={{ marginTop: 4, fontSize: 12 }}>Todos los expedientes están en letra.</p>
          </div>
        </div>
      )}
    </div>
  );
}

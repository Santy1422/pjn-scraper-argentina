import { useEffect, useState } from 'react';
import { api } from '../api';
import { Star } from 'lucide-react';
import { badgeClass } from '../utils';

export default function Favoritos({ setPage, openExpediente }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.favoritos().then(setData);
  }, []);

  if (!data) return (
    <div className="fade-in">
      <h2 className="page-title"><Star size={22} /> Favoritos</h2>
      <div className="panel">
        {Array.from({ length: 4 }).map((_, i) => (
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
      <h2 className="page-title"><Star size={22} /> Favoritos{data.length > 0 ? ` (${data.length})` : ''}</h2>

      {data.length === 0 ? (
        <div className="panel">
          <div className="empty-state" style={{ padding: 40 }}>
            <Star size={32} style={{ color: 'var(--yellow)', marginBottom: 12 }} />
            <p>No tenés expedientes favoritos.</p>
            <p style={{ marginTop: 4, fontSize: 12 }}>Marcá expedientes con la estrella para acceder rápido.</p>
          </div>
        </div>
      ) : (
        <div className="panel">
          <div className="table-wrap">
            <table>
              <thead><tr><th>Clave</th><th>Carátula</th><th>Situación</th><th>Dependencia</th><th>Última Act.</th></tr></thead>
              <tbody>
                {data.map(exp => (
                  <tr key={exp.id} className="clickable-row" onClick={() => openExpediente(exp.id)}>
                    <td style={{ color: 'var(--accent2)', fontWeight: 500 }}>{exp.clave}</td>
                    <td title={exp.caratula}>{exp.caratula?.substring(0, 50)}</td>
                    <td><span className={badgeClass(exp.situacion)}>{exp.situacion || '—'}</span></td>
                    <td>{exp.dependencia?.substring(0, 35)}</td>
                    <td>{exp.ultima_actuacion || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

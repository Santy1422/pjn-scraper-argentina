import { useEffect, useState } from 'react';
import { api } from '../api';
import { Activity } from 'lucide-react';
import { badgeClass } from '../utils';

export default function Actividad({ setPage, openExpediente }) {
  const [tab, setTab] = useState('semana');
  const [semana, setSemana] = useState(null);
  const [recientes, setRecientes] = useState(null);

  useEffect(() => {
    api.actividadSemana().then(setSemana);
    api.actuacionesRecientes(50).then(setRecientes);
  }, []);

  return (
    <div className="fade-in">
      <h2 className="page-title"><Activity size={22} /> Actividad</h2>

      <div className="tabs">
        <button className={`tab-btn ${tab === 'semana' ? 'active' : ''}`} onClick={() => setTab('semana')}>Esta Semana</button>
        <button className={`tab-btn ${tab === 'recientes' ? 'active' : ''}`} onClick={() => setTab('recientes')}>Recientes</button>
      </div>

      {tab === 'semana' && (
        semana ? (
          <>
            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: 20 }}>
              <div className="stat-card accent"><div className="label">Actuaciones</div><div className="value">{semana.total_actuaciones}</div></div>
              <div className="stat-card green"><div className="label">Expedientes movidos</div><div className="value">{semana.expedientes_movidos}</div></div>
              <div className="stat-card"><div className="label">Período</div><div className="value" style={{ fontSize: 14 }}>{semana.desde} — {semana.hasta}</div></div>
            </div>

            {semana.porExpediente.map((exp, i) => (
              <div className="panel" key={i}>
                <div className="panel-header">
                  <h3>
                    <span className="clickable" onClick={() => {
                      // Find expediente ID from clave via the actuaciones data
                      const firstAct = exp.actuaciones[0];
                      if (firstAct?.expediente_id) openExpediente(firstAct.expediente_id);
                    }} style={{ cursor: 'pointer', color: 'var(--accent2)' }}>{exp.clave}</span>
                    <span className={badgeClass(exp.situacion)}>{exp.situacion}</span>
                  </h3>
                  <span style={{ fontSize: 12, color: 'var(--text3)' }}>{exp.actuaciones.length} movimientos</span>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Fecha</th><th>Tipo</th><th>Oficina</th><th>Detalle</th></tr></thead>
                    <tbody>
                      {exp.actuaciones.map((a, j) => (
                        <tr key={j}>
                          <td>{a.fecha}</td>
                          <td><span className={badgeClass(a.tipo)}>{a.tipo}</span></td>
                          <td>{a.oficina?.substring(0, 30)}</td>
                          <td title={a.detalle} style={{ maxWidth: 350, whiteSpace: 'normal' }}>{a.detalle}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}

            {semana.expedientes_movidos === 0 && <div className="empty-state">Sin movimientos esta semana</div>}
          </>
        ) : (
          <div className="panel">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton-row">
                <div className="skeleton skeleton-bar" style={{ width: 80 }} />
                <div className="skeleton skeleton-bar" style={{ flex: 1 }} />
                <div className="skeleton skeleton-bar" style={{ width: 60 }} />
              </div>
            ))}
          </div>
        )
      )}

      {tab === 'recientes' && (
        recientes ? (
          <div className="panel">
            <div className="table-wrap">
              <table>
                <thead><tr><th>Fecha</th><th>Expediente</th><th>Tipo</th><th>Oficina</th><th>Detalle</th></tr></thead>
                <tbody>
                  {recientes.map((a, i) => (
                    <tr key={i}>
                      <td>{a.fecha}</td>
                      <td className="clickable" onClick={() => openExpediente(a.expediente_id)}>{a.clave}</td>
                      <td><span className={badgeClass(a.tipo)}>{a.tipo}</span></td>
                      <td>{a.oficina?.substring(0, 30)}</td>
                      <td title={a.detalle} style={{ maxWidth: 300, whiteSpace: 'normal' }}>{a.detalle}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="panel">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton-row">
                <div className="skeleton skeleton-bar" style={{ width: 80 }} />
                <div className="skeleton skeleton-bar" style={{ width: 100 }} />
                <div className="skeleton skeleton-bar" style={{ flex: 1 }} />
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

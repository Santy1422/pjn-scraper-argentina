import { useEffect, useState } from 'react';
import { api } from '../api';
import { Scale } from 'lucide-react';
import { badgeClass } from '../utils';

function timeAgo(iso) {
  if (!iso) return '';
  const diff = (Date.now() - new Date(iso).getTime()) / 86400000;
  if (diff < 1) return 'hoy';
  if (diff < 2) return 'ayer';
  return `hace ${Math.floor(diff)}d`;
}

export default function Dashboard({ setPage, openExpediente }) {
  const [data, setData] = useState(null);
  const [recientes, setRecientes] = useState(null);

  useEffect(() => {
    api.dashboard().then(setData);
    api.actuacionesRecientes(100).then(setRecientes);
  }, []);

  // Group recientes by expediente
  const grouped = recientes ? Object.values(
    recientes.reduce((acc, a) => {
      if (!acc[a.expediente_id]) {
        acc[a.expediente_id] = {
          expediente_id: a.expediente_id,
          clave: a.clave,
          caratula: a.caratula,
          situacion: a.situacion,
          oficina: a.oficina,
          dependencia: a.dependencia,
          latestDate: a.fecha_iso,
          movimientos: [],
        };
      }
      if (a.fecha_iso > acc[a.expediente_id].latestDate) {
        acc[a.expediente_id].latestDate = a.fecha_iso;
      }
      acc[a.expediente_id].movimientos.push(a);
      return acc;
    }, {})
  ).sort((a, b) => b.latestDate.localeCompare(a.latestDate)) : null;

  if (!data) return (
    <div className="fade-in dash">
      <div className="dash-greeting skeleton" style={{ height: 32, width: 260, borderRadius: 8, marginBottom: 24 }} />
      <div className="dash-kpis">
        {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 72, borderRadius: 12, flex: 1 }} />)}
      </div>
      <div className="panel" style={{ marginTop: 20 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton-row">
            <div className="skeleton skeleton-bar" style={{ width: 100 }} />
            <div className="skeleton skeleton-bar" style={{ flex: 1 }} />
          </div>
        ))}
      </div>
    </div>
  );

  const { stats } = data;
  const hora = new Date().getHours();
  const saludo = hora < 13 ? 'Buenos dias' : hora < 19 ? 'Buenas tardes' : 'Buenas noches';

  return (
    <div className="fade-in dash">
      <div className="dash-greeting">
        <h1>{saludo}</h1>
        <p className="dash-date">{new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </div>

      {/* KPI row */}
      <div className="dash-kpis">
        <div className="kpi" onClick={() => setPage('expedientes')}>
          <div className="kpi-number">{stats.total_expedientes}</div>
          <div className="kpi-label">Expedientes</div>
        </div>
        <div className="kpi kpi-green">
          <div className="kpi-number">{stats.en_letra}</div>
          <div className="kpi-label">En letra</div>
        </div>
        <div className="kpi kpi-red">
          <div className="kpi-number">{stats.en_despacho}</div>
          <div className="kpi-label">En despacho</div>
          {stats.en_despacho > 0 && <div className="kpi-alert" />}
        </div>
      </div>

      {/* Movimientos */}
      <div className="dash-section-header">
        <Scale size={16} />
        <h2>Ultimos movimientos</h2>
        <span className="dash-count">{grouped ? `${grouped.length} expedientes` : ''}</span>
      </div>

      {grouped && grouped.length > 0 ? (
        <div className="dash-feed">
          {grouped.slice(0, 40).map(exp => (
            <div key={exp.expediente_id} className="feed-card" onClick={() => openExpediente(exp.expediente_id)}>
              <div className="feed-top">
                <span className="feed-clave">{exp.clave}</span>
                <span className={badgeClass(exp.situacion)}>{exp.situacion}</span>
                <span className="feed-time">{timeAgo(exp.latestDate)}</span>
              </div>
              <div className="feed-caratula">{exp.caratula}</div>
              {exp.dependencia && <div className="feed-dep">{exp.dependencia}</div>}
              <div className="feed-movs">
                {exp.movimientos.slice(0, 6).map((m, j) => (
                  <div key={j} className="feed-mov">
                    <span className="feed-mov-date">{m.fecha}</span>
                    <span className={`feed-mov-tipo ${m.tipo?.toLowerCase().includes('despacho') ? 'despacho' : m.tipo?.toLowerCase().includes('firma') ? 'firma' : ''}`}>{m.tipo}</span>
                    <span className="feed-mov-det">{m.detalle}</span>
                    {m.fojas && <span className="feed-mov-fojas">fs.{m.fojas}</span>}
                  </div>
                ))}
                {exp.movimientos.length > 6 && (
                  <div className="feed-mov-more">+{exp.movimientos.length - 6} mas</div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : grouped && grouped.length === 0 ? (
        <div className="dash-empty">
          <Scale size={28} />
          <p>Sin movimientos recientes</p>
          <p className="sub">Los expedientes se actualizan automaticamente cada dia</p>
        </div>
      ) : null}
    </div>
  );
}

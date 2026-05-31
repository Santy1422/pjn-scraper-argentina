import { useEffect, useState } from 'react';
import { api } from '../api';
import { BarChart3 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['#6366f1', '#22c55e', '#ef4444', '#eab308', '#3b82f6', '#a855f7', '#ec4899', '#14b8a6', '#f97316', '#64748b'];

export default function Stats() {
  const [stats, setStats] = useState(null);
  const [porJur, setPorJur] = useState([]);
  const [porAnio, setPorAnio] = useState([]);
  const [porDep, setPorDep] = useState([]);
  const [porSit, setPorSit] = useState([]);
  const [semanal, setSemanal] = useState([]);

  useEffect(() => {
    api.stats().then(setStats);
    api.porJurisdiccion().then(setPorJur);
    api.porAnio().then(setPorAnio);
    api.porDependencia().then(setPorDep);
    api.porSituacion().then(setPorSit);
    api.actividadSemanal().then(setSemanal);
  }, []);

  if (!stats) return (
    <div className="fade-in">
      <h2 className="page-title"><BarChart3 size={22} /> Estadísticas</h2>
      <div className="stats-grid">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton skeleton-card" />
        ))}
      </div>
    </div>
  );

  const anioData = [...porAnio].reverse();
  const weekData = [...semanal].reverse().map(w => ({ name: w.semana.replace(/^\d{4}-W/, 'S'), cant: w.cantidad }));
  const jurData = porJur.map((j, i) => ({ ...j, name: j.jurisdiccion_codigo, value: j.cantidad, fill: COLORS[i % COLORS.length] }));
  const sitData = porSit.map((s, i) => ({ name: s.situacion, value: s.cantidad, fill: COLORS[i % COLORS.length] }));

  return (
    <div className="fade-in">
      <h2 className="page-title"><BarChart3 size={22} /> Estadísticas</h2>

      <div className="stats-grid">
        <div className="stat-card accent"><div className="label">Expedientes</div><div className="value">{stats.total_expedientes}</div></div>
        <div className="stat-card green"><div className="label">En Letra</div><div className="value">{stats.en_letra}</div></div>
        <div className="stat-card red"><div className="label">En Despacho</div><div className="value">{stats.en_despacho}</div></div>
        <div className="stat-card blue"><div className="label">Eventos</div><div className="value">{stats.total_eventos}</div></div>
        <div className="stat-card yellow"><div className="label">Actuaciones</div><div className="value">{stats.total_actuaciones}</div></div>
        <div className="stat-card"><div className="label">Documentos</div><div className="value">{stats.total_documentos}</div></div>
      </div>

      <div className="two-col">
        <div className="panel">
          <div className="panel-header"><h3>Expedientes por Año</h3></div>
          <div className="panel-body" style={{ height: 250 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={anioData}>
                <XAxis dataKey="anio" tick={{ fill: '#71717a', fontSize: 11 }} />
                <YAxis tick={{ fill: '#71717a', fontSize: 11 }} />
                <Tooltip contentStyle={{ background: '#1a1d27', border: '1px solid #2e3145', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="cantidad" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header"><h3>Actividad Semanal</h3></div>
          <div className="panel-body" style={{ height: 250 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekData}>
                <XAxis dataKey="name" tick={{ fill: '#71717a', fontSize: 11 }} />
                <YAxis tick={{ fill: '#71717a', fontSize: 11 }} />
                <Tooltip contentStyle={{ background: '#1a1d27', border: '1px solid #2e3145', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="cant" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="two-col">
        <div className="panel">
          <div className="panel-header"><h3>Por Jurisdicción</h3></div>
          <div className="panel-body" style={{ height: 250 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={jurData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name} (${value})`}>
                  {jurData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: '#1a1d27', border: '1px solid #2e3145', borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header"><h3>Por Situación</h3></div>
          <div className="panel-body" style={{ height: 250 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={sitData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name} (${value})`}>
                  {sitData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: '#1a1d27', border: '1px solid #2e3145', borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Top dependencias */}
      <div className="panel">
        <div className="panel-header"><h3>Top Juzgados / Salas</h3></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Dependencia</th><th>Cantidad</th><th></th></tr></thead>
            <tbody>
              {porDep.slice(0, 15).map((d, i) => (
                <tr key={i}>
                  <td>{d.dependencia}</td>
                  <td>{d.cantidad}</td>
                  <td>
                    <div style={{ width: `${(d.cantidad / (porDep[0]?.cantidad || 1)) * 100}%`, height: 6, background: 'var(--accent)', borderRadius: 3, minWidth: 4 }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

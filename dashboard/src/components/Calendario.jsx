import { useEffect, useState, useMemo } from 'react';
import { api } from '../api';
import { Calendar, ChevronLeft, ChevronRight, Plus, Clock, AlertTriangle, CheckCircle, X, Trash2 } from 'lucide-react';

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const PRIORIDAD_COLOR = { critica: '#ef4444', alta: '#f97316', media: '#eab308', baja: '#22c55e' };
const ESTADO_ICON = { pendiente: '○', en_curso: '◐', completada: '●', cancelada: '✕' };

export default function Calendario({ openExpediente }) {
  const [mes, setMes] = useState(() => { const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() }; });
  const [data, setData] = useState({ tareas: [], feriados: [] });
  const [showModal, setShowModal] = useState(false);
  const [modalFecha, setModalFecha] = useState(null);
  const [tareaDetalle, setTareaDetalle] = useState(null);
  const [stats, setStats] = useState(null);

  const desde = `${mes.year}-${String(mes.month + 1).padStart(2, '0')}-01`;
  const hasta = (() => {
    const d = new Date(mes.year, mes.month + 1, 0);
    return d.toISOString().slice(0, 10);
  })();

  useEffect(() => {
    const d1 = new Date(mes.year, mes.month, 1);
    d1.setDate(d1.getDate() - 7);
    const d2 = new Date(mes.year, mes.month + 1, 0);
    d2.setDate(d2.getDate() + 7);
    api.tareasCalendario(d1.toISOString().slice(0, 10), d2.toISOString().slice(0, 10)).then(setData);
    api.tareasStats().then(setStats);
  }, [mes]);

  // Build calendar grid
  const grid = useMemo(() => {
    const firstDay = new Date(mes.year, mes.month, 1);
    let startDow = firstDay.getDay() - 1; // Mon=0
    if (startDow < 0) startDow = 6;
    const daysInMonth = new Date(mes.year, mes.month + 1, 0).getDate();

    const cells = [];
    // Fill previous month
    for (let i = startDow - 1; i >= 0; i--) {
      const d = new Date(mes.year, mes.month, -i);
      cells.push({ date: d, outside: true });
    }
    // Current month
    for (let i = 1; i <= daysInMonth; i++) {
      cells.push({ date: new Date(mes.year, mes.month, i), outside: false });
    }
    // Fill next month
    while (cells.length % 7 !== 0) {
      const d = new Date(mes.year, mes.month + 1, cells.length - startDow - daysInMonth + 1);
      cells.push({ date: d, outside: true });
    }
    return cells;
  }, [mes]);

  const feriadoMap = useMemo(() => {
    const m = {};
    for (const f of data.feriados) {
      m[f.fecha] = f;
    }
    return m;
  }, [data.feriados]);

  const tareaMap = useMemo(() => {
    const m = {};
    for (const t of data.tareas) {
      if (!t.fecha_vencimiento) continue;
      if (!m[t.fecha_vencimiento]) m[t.fecha_vencimiento] = [];
      m[t.fecha_vencimiento].push(t);
    }
    return m;
  }, [data.tareas]);

  const hoy = new Date().toISOString().slice(0, 10);

  function prevMes() { setMes(m => m.month === 0 ? { year: m.year - 1, month: 11 } : { ...m, month: m.month - 1 }); }
  function nextMes() { setMes(m => m.month === 11 ? { year: m.year + 1, month: 0 } : { ...m, month: m.month + 1 }); }

  function clickDay(dateStr) {
    setModalFecha(dateStr);
    setShowModal(true);
  }

  async function cambiarEstado(tareaId, nuevoEstado) {
    await api.cambiarEstadoTarea(tareaId, nuevoEstado);
    // Refresh
    const d1 = new Date(mes.year, mes.month, 1);
    d1.setDate(d1.getDate() - 7);
    const d2 = new Date(mes.year, mes.month + 1, 0);
    d2.setDate(d2.getDate() + 7);
    api.tareasCalendario(d1.toISOString().slice(0, 10), d2.toISOString().slice(0, 10)).then(setData);
    api.tareasStats().then(setStats);
    if (tareaDetalle?.id === tareaId) {
      api.tarea(tareaId).then(setTareaDetalle);
    }
  }

  async function eliminarTarea(tareaId) {
    await api.deleteTarea(tareaId);
    setTareaDetalle(null);
    const d1 = new Date(mes.year, mes.month, 1);
    d1.setDate(d1.getDate() - 7);
    const d2 = new Date(mes.year, mes.month + 1, 0);
    d2.setDate(d2.getDate() + 7);
    api.tareasCalendario(d1.toISOString().slice(0, 10), d2.toISOString().slice(0, 10)).then(setData);
    api.tareasStats().then(setStats);
  }

  return (
    <div className="fade-in">
      <h2 className="page-title"><Calendar size={22} /> Calendario y Vencimientos</h2>

      {/* Stats */}
      {stats && (
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(5,1fr)', marginBottom: 20 }}>
          <div className="stat-card accent"><div className="label">Pendientes</div><div className="value">{stats.pendientes}</div></div>
          <div className="stat-card yellow"><div className="label">En Curso</div><div className="value">{stats.en_curso}</div></div>
          <div className="stat-card green"><div className="label">Completadas</div><div className="value">{stats.completadas}</div></div>
          <div className="stat-card red"><div className="label">Vencidas</div><div className="value">{stats.vencidas}</div></div>
          <div className="stat-card blue"><div className="label">Próx. 3 días</div><div className="value">{stats.proximas_3d}</div></div>
        </div>
      )}

      <div className="cal-layout">
        {/* Calendar */}
        <div className="panel cal-panel">
          <div className="cal-header">
            <button className="cal-nav" onClick={prevMes}><ChevronLeft size={18} /></button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h3>{MESES[mes.month]} {mes.year}</h3>
              <button className="btn-hoy" onClick={() => { const d = new Date(); setMes({ year: d.getFullYear(), month: d.getMonth() }); }}>Hoy</button>
            </div>
            <button className="cal-nav" onClick={nextMes}><ChevronRight size={18} /></button>
          </div>
          <div className="cal-grid">
            {DIAS.map(d => <div key={d} className="cal-dow">{d}</div>)}
            {grid.map((cell, i) => {
              const iso = cell.date.toISOString().slice(0, 10);
              const feriado = feriadoMap[iso];
              const tareas = tareaMap[iso] || [];
              const isHoy = iso === hoy;
              const isWeekend = cell.date.getDay() === 0 || cell.date.getDay() === 6;
              return (
                <div
                  key={i}
                  className={`cal-cell ${cell.outside ? 'outside' : ''} ${isHoy ? 'today' : ''} ${feriado ? 'feriado' : ''} ${isWeekend ? 'weekend' : ''}`}
                  onClick={() => !cell.outside && clickDay(iso)}
                >
                  <span className="cal-day">{cell.date.getDate()}</span>
                  {feriado && <span className="cal-feriado-dot" title={feriado.descripcion} />}
                  {tareas.slice(0, 3).map((t, j) => (
                    <div
                      key={j}
                      className={`cal-event ${t.estado}`}
                      style={{ borderLeftColor: PRIORIDAD_COLOR[t.prioridad] }}
                      onClick={e => { e.stopPropagation(); setTareaDetalle(t); }}
                      title={t.titulo}
                    >
                      {t.titulo.length > 18 ? t.titulo.substring(0, 16) + '…' : t.titulo}
                    </div>
                  ))}
                  {tareas.length > 3 && <span className="cal-more">+{tareas.length - 3}</span>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Side panel */}
        <div className="cal-side">
          {/* Crear tarea */}
          <button className="btn-primary" style={{ width: '100%', marginBottom: 16, justifyContent: 'center' }}
            onClick={() => { setModalFecha(hoy); setShowModal(true); }}>
            <Plus size={14} /> Nueva Tarea
          </button>

          {/* Tarea detalle */}
          {tareaDetalle && (
            <div className="panel" style={{ marginBottom: 16 }}>
              <div className="panel-header">
                <h3 style={{ fontSize: 13 }}>{tareaDetalle.titulo}</h3>
                <button className="nota-delete" onClick={() => setTareaDetalle(null)}><X size={14} /></button>
              </div>
              <div className="panel-body" style={{ fontSize: 13 }}>
                <div style={{ marginBottom: 8 }}>
                  <span className={`badge ${tareaDetalle.estado === 'completada' ? 'letra' : tareaDetalle.estado === 'pendiente' ? 'otro' : 'giro'}`}>
                    {tareaDetalle.estado}
                  </span>
                  {' '}
                  <span className="badge" style={{ background: PRIORIDAD_COLOR[tareaDetalle.prioridad] + '22', color: PRIORIDAD_COLOR[tareaDetalle.prioridad] }}>
                    {tareaDetalle.prioridad}
                  </span>
                </div>
                {tareaDetalle.clave && (
                  <p style={{ marginBottom: 6 }}>
                    <span className="clickable" onClick={() => openExpediente(tareaDetalle.expediente_id)}>{tareaDetalle.clave}</span>
                  </p>
                )}
                <p style={{ color: 'var(--text3)', marginBottom: 6 }}>Vence: {tareaDetalle.fecha_vencimiento || '—'}</p>
                {tareaDetalle.descripcion && <p style={{ color: 'var(--text2)', marginBottom: 8 }}>{tareaDetalle.descripcion}</p>}
                {tareaDetalle.dias_plazo && <p style={{ color: 'var(--text3)', fontSize: 11 }}>{tareaDetalle.dias_plazo} días {tareaDetalle.tipo_plazo} desde {tareaDetalle.fecha_inicio}</p>}
                <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                  {tareaDetalle.estado !== 'completada' && (
                    <button className="btn-ghost" style={{ fontSize: 11, padding: '4px 8px' }}
                      onClick={() => cambiarEstado(tareaDetalle.id, 'completada')}>
                      <CheckCircle size={12} /> Completar
                    </button>
                  )}
                  {tareaDetalle.estado === 'pendiente' && (
                    <button className="btn-ghost" style={{ fontSize: 11, padding: '4px 8px' }}
                      onClick={() => cambiarEstado(tareaDetalle.id, 'en_curso')}>
                      <Clock size={12} /> En curso
                    </button>
                  )}
                  <button className="btn-ghost" style={{ fontSize: 11, padding: '4px 8px', color: 'var(--red)' }}
                    onClick={() => eliminarTarea(tareaDetalle.id)}>
                    <Trash2 size={12} /> Eliminar
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Próximos vencimientos */}
          <div className="panel">
            <div className="panel-header"><h3><AlertTriangle size={14} /> Próximos vencimientos</h3></div>
            <div className="panel-body">
              {data.tareas
                .filter(t => t.estado !== 'completada' && t.estado !== 'cancelada' && t.fecha_vencimiento >= hoy)
                .sort((a, b) => a.fecha_vencimiento.localeCompare(b.fecha_vencimiento))
                .slice(0, 8)
                .map(t => (
                  <div key={t.id} className="alerta-row" style={{ cursor: 'pointer' }} onClick={() => setTareaDetalle(t)}>
                    <span style={{ color: PRIORIDAD_COLOR[t.prioridad], fontSize: 16, flexShrink: 0 }}>{ESTADO_ICON[t.estado]}</span>
                    <div className="info">
                      <div className="clave">{t.titulo}</div>
                      <div className="caratula">{t.fecha_vencimiento} — {t.clave || 'Sin expediente'}</div>
                    </div>
                  </div>
                ))}
              {data.tareas.filter(t => t.estado !== 'completada' && t.fecha_vencimiento >= hoy).length === 0 && (
                <p style={{ color: 'var(--text3)', fontSize: 13 }}>Sin vencimientos próximos</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal crear tarea */}
      {showModal && <CrearTareaModal
        fecha={modalFecha}
        onClose={() => setShowModal(false)}
        onCreated={() => {
          setShowModal(false);
          const d1 = new Date(mes.year, mes.month, 1);
          d1.setDate(d1.getDate() - 7);
          const d2 = new Date(mes.year, mes.month + 1, 0);
          d2.setDate(d2.getDate() + 7);
          api.tareasCalendario(d1.toISOString().slice(0, 10), d2.toISOString().slice(0, 10)).then(setData);
          api.tareasStats().then(setStats);
        }}
      />}
    </div>
  );
}

function CrearTareaModal({ fecha, onClose, onCreated }) {
  const [modo, setModo] = useState('manual'); // manual | regla
  const [reglas, setReglas] = useState([]);
  const [expedientes, setExpedientes] = useState([]);
  const [form, setForm] = useState({
    titulo: '', descripcion: '', prioridad: 'media',
    expediente_id: '', fecha_inicio: fecha, dias_plazo: '', tipo_plazo: 'habiles',
    regla_id: '',
  });
  const [vencCalc, setVencCalc] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.reglasPlazos().then(setReglas);
    api.expedientes().then(setExpedientes);
  }, []);

  // Calcular vencimiento en vivo
  useEffect(() => {
    if (form.fecha_inicio && form.dias_plazo && parseInt(form.dias_plazo) > 0) {
      api.calcularVencimiento(form.fecha_inicio, form.dias_plazo, form.tipo_plazo)
        .then(r => setVencCalc(r.vencimiento));
    } else {
      setVencCalc(null);
    }
  }, [form.fecha_inicio, form.dias_plazo, form.tipo_plazo]);

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    if (modo === 'regla' && form.regla_id) {
      await api.crearTareaDesdeRegla({
        regla_id: parseInt(form.regla_id),
        expediente_id: form.expediente_id ? parseInt(form.expediente_id) : null,
        fecha_inicio: form.fecha_inicio,
      });
    } else {
      await api.crearTarea({
        expediente_id: form.expediente_id ? parseInt(form.expediente_id) : null,
        titulo: form.titulo,
        descripcion: form.descripcion,
        prioridad: form.prioridad,
        fecha_inicio: form.fecha_inicio,
        dias_plazo: form.dias_plazo ? parseInt(form.dias_plazo) : null,
        tipo_plazo: form.tipo_plazo,
      });
    }
    setLoading(false);
    onCreated();
  }

  function selectRegla(id) {
    const r = reglas.find(r => r.id === parseInt(id));
    if (r) {
      setForm({ ...form, regla_id: id, titulo: r.nombre, dias_plazo: String(r.dias), tipo_plazo: r.tipo_plazo, prioridad: r.prioridad_default, descripcion: r.descripcion || '' });
    }
  }

  return (
    <div className="search-overlay" onClick={onClose}>
      <div className="search-modal" style={{ width: 520, maxHeight: '80vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
        <div className="panel-header">
          <h3><Plus size={16} /> Nueva Tarea</h3>
          <button className="nota-delete" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="panel-body">
          {/* Modo tabs */}
          <div className="tabs" style={{ marginBottom: 14 }}>
            <button className={`tab-btn ${modo === 'manual' ? 'active' : ''}`} onClick={() => setModo('manual')}>Manual</button>
            <button className={`tab-btn ${modo === 'regla' ? 'active' : ''}`} onClick={() => setModo('regla')}>Desde Plazo Procesal</button>
          </div>

          <form onSubmit={submit}>
            {modo === 'regla' && (
              <div className="form-field">
                <label>Plazo procesal</label>
                <select value={form.regla_id} onChange={e => selectRegla(e.target.value)} required>
                  <option value="">Seleccionar plazo...</option>
                  {reglas.map(r => (
                    <option key={r.id} value={r.id}>{r.nombre} ({r.dias}d {r.tipo_plazo})</option>
                  ))}
                </select>
              </div>
            )}

            {modo === 'manual' && (
              <>
                <div className="form-field">
                  <label>Título</label>
                  <input value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} required placeholder="Ej: Contestar traslado" />
                </div>
                <div className="form-field">
                  <label>Descripción</label>
                  <textarea value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} rows={2} placeholder="Opcional" />
                </div>
              </>
            )}

            <div className="form-row">
              <div className="form-field">
                <label>Expediente</label>
                <select value={form.expediente_id} onChange={e => setForm({ ...form, expediente_id: e.target.value })}>
                  <option value="">Sin expediente</option>
                  {expedientes.slice(0, 50).map(exp => (
                    <option key={exp.id} value={exp.id}>{exp.clave} — {exp.caratula?.substring(0, 30)}</option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label>Prioridad</label>
                <select value={form.prioridad} onChange={e => setForm({ ...form, prioridad: e.target.value })}>
                  <option value="critica">Crítica</option>
                  <option value="alta">Alta</option>
                  <option value="media">Media</option>
                  <option value="baja">Baja</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-field">
                <label>Fecha inicio (notificación)</label>
                <input type="date" value={form.fecha_inicio} onChange={e => setForm({ ...form, fecha_inicio: e.target.value })} required />
              </div>
              <div className="form-field">
                <label>Plazo (días)</label>
                <input type="number" value={form.dias_plazo} onChange={e => setForm({ ...form, dias_plazo: e.target.value })} min="1" placeholder="Ej: 5" />
              </div>
              <div className="form-field">
                <label>Tipo</label>
                <select value={form.tipo_plazo} onChange={e => setForm({ ...form, tipo_plazo: e.target.value })}>
                  <option value="habiles">Hábiles</option>
                  <option value="corridos">Corridos</option>
                </select>
              </div>
            </div>

            {vencCalc && (
              <div className="venc-preview">
                <Clock size={14} /> Vence: <strong>{vencCalc}</strong> ({form.dias_plazo} días {form.tipo_plazo})
              </div>
            )}

            <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: 14, justifyContent: 'center' }} disabled={loading}>
              {loading ? 'Creando...' : 'Crear Tarea'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState, useRef } from 'react';
import { api } from '../api';
import { ArrowLeft, Star, Building, Calendar, MapPin, FileText, Send, Trash2, StickyNote, Clock, Users, Download, ExternalLink, Plus, CheckCircle, ListTodo, Upload, Eye, X, Edit3, FilePlus } from 'lucide-react';
import { badgeClass, formatFecha, formatFechaHora } from '../utils';
import GeneradorEscrito from './GeneradorEscrito';

export default function ExpedienteDetalle({ id, setPage, openExpediente }) {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('actuaciones');
  const [timeline, setTimeline] = useState(null);
  const [notas, setNotas] = useState([]);
  const [tareas, setTareas] = useState([]);
  const [escritos, setEscritos] = useState([]);
  const [borradores, setBorradores] = useState([]);
  const [notaTexto, setNotaTexto] = useState('');
  const [fav, setFav] = useState(false);
  const [showNewTarea, setShowNewTarea] = useState(false);
  const [reglas, setReglas] = useState([]);
  const [pdfViewer, setPdfViewer] = useState(null);
  const [showUpload, setShowUpload] = useState(false);
  const [generador, setGenerador] = useState(null); // { borrador } or {} for new

  useEffect(() => {
    if (!id) return;
    api.expediente(id).then(d => { setData(d); setFav(!!d.favorito); });
    api.timeline(id).then(setTimeline);
    api.getNotas(id).then(setNotas);
    api.tareasByExpediente(id).then(setTareas);
    api.getEscritos(id).then(setEscritos);
    api.reglasPlazos().then(setReglas);
    api.getBorradores(id).then(setBorradores);
  }, [id]);

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') {
        if (pdfViewer) setPdfViewer(null);
        else if (generador) setGenerador(null);
        else if (!showNewTarea && !showUpload) setPage('expedientes');
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setPage, showNewTarea, showUpload, pdfViewer, generador]);

  async function toggleFav() {
    const res = await api.toggleFavorito(id);
    setFav(!!res.favorito);
  }

  async function addNota(e) {
    e.preventDefault();
    if (!notaTexto.trim()) return;
    const updated = await api.addNota(id, notaTexto);
    setNotas(updated);
    setNotaTexto('');
  }

  async function removeNota(notaId) {
    await api.deleteNota(notaId);
    setNotas(notas.filter(n => n.id !== notaId));
  }

  function openPdf(url, title) {
    setPdfViewer({ url, title });
  }

  if (!data) return (
    <div className="fade-in">
      <div className="skeleton skeleton-bar" style={{ width: 120, height: 30, marginBottom: 16 }} />
      <div className="skeleton skeleton-bar" style={{ width: '60%', height: 24, marginBottom: 8 }} />
      <div className="skeleton skeleton-bar" style={{ width: '40%', height: 16, marginBottom: 24 }} />
      <div className="panel">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="skeleton-row">
            <div className="skeleton skeleton-bar" style={{ width: 80 }} />
            <div className="skeleton skeleton-bar" style={{ flex: 1 }} />
            <div className="skeleton skeleton-bar" style={{ width: 60 }} />
          </div>
        ))}
      </div>
    </div>
  );

  // If in document generator mode
  if (generador) {
    return (
      <GeneradorEscrito
        expediente={data}
        borrador={generador.borrador || null}
        onBack={() => { setGenerador(null); api.getBorradores(id).then(setBorradores); }}
        onSaved={(saved) => { setGenerador({ borrador: saved }); }}
      />
    );
  }

  const pendientes = tareas.filter(t => t.estado === 'pendiente' || t.estado === 'en_curso');

  async function crearTareaRapida(reglaId) {
    await api.crearTareaDesdeRegla({ regla_id: reglaId, expediente_id: id, fecha_inicio: new Date().toISOString().slice(0,10) });
    api.tareasByExpediente(id).then(setTareas);
    setShowNewTarea(false);
  }

  async function completarTarea(tareaId, titulo) {
    if (!confirm(`Marcar como completada?\n\n${titulo}`)) return;
    await api.cambiarEstadoTarea(tareaId, 'completada');
    api.tareasByExpediente(id).then(setTareas);
  }

  async function editarDescTarea(tareaId, descActual) {
    const nueva = prompt('Descripcion / contexto de la tarea:', descActual || '');
    if (nueva === null) return;
    await api.updateTarea(tareaId, { descripcion: nueva });
    api.tareasByExpediente(id).then(setTareas);
  }

  async function deleteEscrito(escritoId) {
    await api.deleteEscrito(escritoId);
    api.getEscritos(id).then(setEscritos);
  }

  async function deleteBorrador(borradorId) {
    if (!confirm('Eliminar este borrador?')) return;
    await api.deleteBorrador(borradorId);
    api.getBorradores(id).then(setBorradores);
  }

  const mainTabs = [
    { id: 'actuaciones', label: 'Actuaciones', count: data.actuaciones?.length },
    { id: 'timeline', label: 'Timeline' },
    { id: 'eventos', label: 'Eventos', count: data.eventos?.length },
    { id: 'escritos', label: 'Escritos', count: (escritos.length + borradores.length) || null },
    { id: 'partes', label: 'Partes', count: data.partes?.length },
    { id: 'documentos', label: 'Docs', count: data.documentos?.length },
  ];

  return (
    <div className="fade-in">
      <button className="back-btn" onClick={() => setPage('expedientes')}>
        <ArrowLeft size={14} /> Volver
      </button>

      {/* Header */}
      <div className="detail-header">
        <div className="clave">
          {data.clave}
          <span className={badgeClass(data.situacion)}>{data.situacion}</span>
          <button className={`fav-btn ${fav ? 'active' : ''}`} onClick={toggleFav} title={fav ? 'Quitar de favoritos' : 'Agregar a favoritos'}>
            <Star size={20} fill={fav ? 'currentColor' : 'none'} />
          </button>
        </div>
        <div className="caratula">{data.caratula}</div>
        <div className="meta">
          <span><Building size={14} /> {data.dependencia || 'Sin dependencia'}</span>
          <span><Calendar size={14} /> Ult. act: {data.ultima_actuacion || '--'}</span>
          <span><MapPin size={14} /> {data.jurisdiccion_codigo} -- {data.numero}/{data.anio}{data.sufijo ? `/${data.sufijo}` : ''}</span>
          {data.fecha_inicio && <span><Clock size={14} /> Inicio: {data.fecha_inicio}</span>}
        </div>
      </div>

      {/* Two-column layout: main + sidebar */}
      <div className="detail-layout">
        {/* MAIN CONTENT */}
        <div className="detail-main">
          {/* Tabs */}
          <div className="tabs">
            {mainTabs.map(t => (
              <button key={t.id} className={`tab-btn ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
                {t.label}{t.count != null ? ` (${t.count})` : ''}
              </button>
            ))}
          </div>

          {/* TAB: Actuaciones */}
          {tab === 'actuaciones' && (
            <div className="panel">
              {data.actuaciones?.length > 0 ? (
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Fecha</th><th>Tipo</th><th>Oficina</th><th>Detalle</th><th>Fojas</th><th></th></tr></thead>
                    <tbody>
                      {data.actuaciones.map((a, i) => (
                        <tr key={a.id || i}>
                          <td>{a.fecha}</td>
                          <td><span className={badgeClass(a.tipo)}>{a.tipo || '--'}</span></td>
                          <td title={a.oficina}>{a.oficina?.substring(0, 45)}</td>
                          <td title={a.detalle} style={{ maxWidth: 380, whiteSpace: 'normal', lineHeight: 1.4 }}>{a.detalle}</td>
                          <td>{a.fojas || '--'}</td>
                          <td>
                            {a.url_ver && (
                              <button className="btn-icon" onClick={() => openPdf(a.url_ver, `${a.tipo} -- ${a.detalle?.substring(0, 40)}`)} title="Ver documento">
                                <Eye size={14} />
                              </button>
                            )}
                            {a.url_descarga && (
                              <a href={a.url_descarga} target="_blank" rel="noreferrer" title="Descargar" style={{ marginLeft: 6 }}>
                                <Download size={14} />
                              </a>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="panel-body empty-state" style={{ padding: 30 }}>
                  <FileText size={24} style={{ color: 'var(--text3)', marginBottom: 8 }} />
                  <p>Sin actuaciones registradas.</p>
                </div>
              )}
            </div>
          )}

          {/* TAB: Timeline */}
          {tab === 'timeline' && (
            <div className="panel">
              <div className="panel-body">
                {timeline ? (
                  timeline.timeline.length > 0 ? (
                    <div className="timeline">
                      {timeline.timeline.map((item, i) => (
                        <div key={i} className={`timeline-item ${item.origen}`}>
                          <div className="tl-date">{item.fecha}</div>
                          <div className="tl-tipo">
                            <span className={badgeClass(item.tipo)}>{item.tipo}</span>
                            {' '}
                            <span style={{ fontSize: 11, color: 'var(--text3)' }}>
                              {item.origen === 'evento' ? '(evento PJN)' : '(actuacion SCW)'}
                            </span>
                          </div>
                          <div className="tl-desc">{item.descripcion}</div>
                          {item.oficina && <div className="tl-meta">{item.oficina}{item.fojas ? ` -- fs. ${item.fojas}` : ''}</div>}
                          {item.pdf_path && (
                            <div className="tl-meta">
                              <button className="link-btn" onClick={() => openPdf(`/api/pdfs/${item.pdf_path.split('/').pop()}`, item.descripcion?.substring(0, 40))}>
                                <Eye size={12} /> Ver PDF
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : <div className="empty-state">Sin actividad registrada</div>
                ) : <div className="loader">Cargando timeline...</div>}
              </div>
            </div>
          )}

          {/* TAB: Eventos */}
          {tab === 'eventos' && (
            <div className="panel">
              {data.eventos?.length > 0 ? (
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Fecha</th><th>Tipo</th><th>Caratula</th><th>CUIL</th><th>PDF</th></tr></thead>
                    <tbody>
                      {data.eventos.map(ev => (
                        <tr key={ev.id}>
                          <td>{formatFechaHora(ev.fecha_creacion)}</td>
                          <td><span className={`badge ${ev.tipo === 'cedula' ? 'cedula' : 'despacho'}`}>{ev.tipo}</span></td>
                          <td title={ev.caratula_expediente} style={{ maxWidth: 300 }}>{ev.caratula_expediente}</td>
                          <td>{ev.cuil_destinatario || '--'}</td>
                          <td>
                            {ev.pdf_descargado && ev.pdf_path ? (
                              <button className="link-btn" onClick={() => openPdf(`/api/pdfs/${ev.pdf_path.split('/').pop()}`, `${ev.tipo}`)}>
                                <Eye size={13} /> Ver
                              </button>
                            ) : ev.pdf_descargado ? 'OK' : '--'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="panel-body empty-state">Sin eventos (cedulas/despachos)</div>
              )}
            </div>
          )}

          {/* TAB: Escritos + Borradores */}
          {tab === 'escritos' && (
            <div className="panel">
              <div className="panel-header">
                <h3><FileText size={16} /> Escritos y documentos</h3>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn-primary" style={{ padding: '5px 12px', fontSize: 12 }} onClick={() => setGenerador({})}>
                    <FilePlus size={13} /> Generar escrito
                  </button>
                  <button className="btn-ghost" style={{ padding: '5px 12px', fontSize: 12 }} onClick={() => setShowUpload(!showUpload)}>
                    <Upload size={13} /> Cargar archivo
                  </button>
                </div>
              </div>

              {showUpload && <UploadEscritoForm expedienteId={id} onDone={() => { setShowUpload(false); api.getEscritos(id).then(setEscritos); }} />}

              {/* Borradores */}
              {borradores.length > 0 && (
                <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Borradores</div>
                  {borradores.map(b => (
                    <div key={b.id} className="borrador-row">
                      <div className="borrador-info" onClick={() => setGenerador({ borrador: b })}>
                        <Edit3 size={14} />
                        <span className="borrador-titulo">{b.titulo}</span>
                        <span className="badge otro" style={{ fontSize: 10 }}>{b.tipo}</span>
                        <span style={{ fontSize: 11, color: 'var(--text3)' }}>{b.updated_at?.substring(0, 10)}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="nota-delete" onClick={() => deleteBorrador(b.id)} title="Eliminar">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Escritos uploaded */}
              {escritos.length > 0 ? (
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Fecha</th><th>Titulo</th><th>Tipo</th><th>Archivo</th><th></th></tr></thead>
                    <tbody>
                      {escritos.map(e => (
                        <tr key={e.id}>
                          <td>{e.fecha_presentacion || e.created_at?.substring(0, 10)}</td>
                          <td style={{ fontWeight: 500, color: 'var(--text)' }}>{e.titulo}</td>
                          <td><span className="badge otro">{e.tipo}</span></td>
                          <td>
                            {e.archivo_path ? (
                              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                <button className="link-btn" onClick={() => openPdf(`/api/escritos/${e.archivo_path}`, e.titulo)}>
                                  <Eye size={13} /> Ver
                                </button>
                                <a href={`/api/escritos/${e.archivo_path}`} target="_blank" rel="noreferrer" title="Descargar">
                                  <Download size={13} />
                                </a>
                              </div>
                            ) : '--'}
                          </td>
                          <td>
                            <button className="nota-delete" onClick={() => deleteEscrito(e.id)} title="Eliminar">
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : !showUpload && borradores.length === 0 && (
                <div className="panel-body empty-state" style={{ padding: 30 }}>
                  <FileText size={24} style={{ color: 'var(--text3)', marginBottom: 8 }} />
                  <p>Sin escritos. Genera uno desde una plantilla o carga un archivo.</p>
                </div>
              )}
            </div>
          )}

          {/* TAB: Partes */}
          {tab === 'partes' && (
            <div className="panel">
              {data.partes?.length > 0 ? (
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Tipo</th><th>Nombre</th><th>CUIT</th><th>Matricula</th></tr></thead>
                    <tbody>
                      {data.partes.map((p, i) => (
                        <tr key={p.id || i}>
                          <td>
                            <span className={`badge ${p.tipo === 'ACTOR' ? 'letra' : p.tipo === 'DEMANDADO' ? 'despacho' : 'otro'}`}>
                              {p.tipo}
                            </span>
                          </td>
                          <td style={{ fontWeight: 500, color: 'var(--text)' }}>{p.nombre}</td>
                          <td>{p.cuit || '--'}</td>
                          <td>{p.matricula || '--'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="panel-body empty-state">
                  <Users size={24} style={{ marginBottom: 8, color: 'var(--text3)' }} />
                  <p>Sin partes registradas.</p>
                </div>
              )}
            </div>
          )}

          {/* TAB: Documentos */}
          {tab === 'documentos' && (
            <div className="panel">
              {data.documentos?.length > 0 ? (
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Nombre</th><th>Tipo</th><th>Tamano</th><th>Fecha</th><th></th></tr></thead>
                    <tbody>
                      {data.documentos.map((d, i) => (
                        <tr key={d.id || i}>
                          <td style={{ color: 'var(--text)' }}>{d.nombre || `documento_${i + 1}`}</td>
                          <td>{d.tipo_archivo}</td>
                          <td>{d.tamano_bytes ? `${(d.tamano_bytes / 1024).toFixed(1)} KB` : '--'}</td>
                          <td>{d.created_at?.substring(0, 10) || '--'}</td>
                          <td>
                            {d.path_local && (
                              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                <button className="link-btn" onClick={() => openPdf(`/api/pdfs/${d.path_local.split('/').pop()}`, d.nombre)}>
                                  <Eye size={13} /> Ver
                                </button>
                                <a href={`/api/pdfs/${d.path_local.split('/').pop()}`} target="_blank" rel="noreferrer">
                                  <Download size={13} />
                                </a>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="panel-body empty-state">
                  <FileText size={24} style={{ marginBottom: 8, color: 'var(--text3)' }} />
                  <p>Sin documentos descargados</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* SIDEBAR: Escritos + Tareas + Notas always visible */}
        <div className="detail-sidebar">
          {/* Redactar escrito - prominent */}
          <div className="sidebar-section">
            <div className="sidebar-section-header">
              <FilePlus size={14} />
              <span>Escritos</span>
            </div>
            <div className="sidebar-escritos">
              <button className="sidebar-crear-escrito" onClick={() => setGenerador({})}>
                <FilePlus size={16} />
                <div>
                  <div className="sidebar-crear-titulo">Redactar escrito</div>
                  <div className="sidebar-crear-sub">Plantillas judiciales con auto-fill</div>
                </div>
              </button>
              {borradores.length > 0 && (
                <div className="sidebar-borradores">
                  {borradores.slice(0, 4).map(b => (
                    <div key={b.id} className="sidebar-borrador" onClick={() => setGenerador({ borrador: b })}>
                      <Edit3 size={12} />
                      <span className="sidebar-borrador-titulo">{b.titulo}</span>
                      <span className="sidebar-borrador-fecha">{b.updated_at?.substring(5, 10)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Tareas */}
          <div className="sidebar-section">
            <div className="sidebar-section-header">
              <ListTodo size={14} />
              <span>Tareas</span>
              {pendientes.length > 0 && <span className="badge despacho" style={{ fontSize: 10 }}>{pendientes.length}</span>}
              <button className="btn-icon" style={{ marginLeft: 'auto' }} onClick={() => setShowNewTarea(!showNewTarea)} title="Nueva tarea">
                <Plus size={14} />
              </button>
            </div>

            {showNewTarea && (
              <div className="sidebar-new-tarea">
                {reglas.slice(0, 8).map(r => (
                  <button key={r.id} className="btn-ghost" style={{ fontSize: 10, padding: '3px 8px', width: '100%', textAlign: 'left' }}
                    onClick={() => crearTareaRapida(r.id)}>
                    {r.nombre} ({r.dias}d)
                  </button>
                ))}
              </div>
            )}

            <div className="sidebar-tareas-list">
              {tareas.slice(0, 10).map(t => (
                <div key={t.id} className={`sidebar-tarea ${t.estado}`}>
                  <button
                    className={`tarea-check-sm ${t.estado}`}
                    onClick={() => t.estado !== 'completada' && completarTarea(t.id, t.titulo)}
                  >
                    {t.estado === 'completada' ? <CheckCircle size={14} /> : <div className="tarea-circle-sm" />}
                  </button>
                  <div className="sidebar-tarea-info">
                    <div className="sidebar-tarea-titulo">{t.titulo}</div>
                    {t.descripcion && <div className="sidebar-tarea-desc">{t.descripcion}</div>}
                    <div className="sidebar-tarea-desc clickable" onClick={() => editarDescTarea(t.id, t.descripcion)}>
                      {!t.descripcion && '+ contexto'}
                    </div>
                    {t.fecha_vencimiento && (
                      <span style={{ fontSize: 10, color: 'var(--text3)' }}>
                        <Clock size={10} /> {t.fecha_vencimiento}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {tareas.length === 0 && (
                <div style={{ padding: '12px 0', fontSize: 12, color: 'var(--text3)', textAlign: 'center' }}>
                  Sin tareas
                </div>
              )}
            </div>
          </div>

          {/* Notas */}
          <div className="sidebar-section">
            <div className="sidebar-section-header">
              <StickyNote size={14} />
              <span>Notas</span>
              {notas.length > 0 && <span style={{ fontSize: 10, color: 'var(--text3)' }}>{notas.length}</span>}
            </div>

            <form onSubmit={addNota} className="sidebar-nota-form">
              <textarea
                placeholder="Escribi una nota..."
                value={notaTexto}
                onChange={e => setNotaTexto(e.target.value)}
                rows={2}
              />
              {notaTexto.trim() && (
                <button type="submit"><Send size={12} /></button>
              )}
            </form>

            <div className="sidebar-notas-list">
              {notas.map(n => (
                <div key={n.id} className="sidebar-nota">
                  <div className="sidebar-nota-texto">{n.texto}</div>
                  <div className="sidebar-nota-footer">
                    <span>{n.created_at?.substring(0, 10)}</span>
                    <button className="nota-delete" onClick={() => removeNota(n.id)}>
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* PDF Viewer overlay */}
      {pdfViewer && (
        <div className="pdf-overlay">
          <div className="pdf-viewer">
            <div className="pdf-header">
              <span className="pdf-title">{pdfViewer.title || 'Documento'}</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <a href={pdfViewer.url} target="_blank" rel="noreferrer" className="btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }}>
                  <ExternalLink size={13} /> Abrir
                </a>
                <button className="nota-delete" onClick={() => setPdfViewer(null)}><X size={18} /></button>
              </div>
            </div>
            <iframe src={pdfViewer.url} className="pdf-iframe" title="Visor de documento" />
          </div>
        </div>
      )}
    </div>
  );
}

function UploadEscritoForm({ expedienteId, onDone }) {
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [tipo, setTipo] = useState('escrito');
  const [fechaPres, setFechaPres] = useState(new Date().toISOString().slice(0, 10));
  const [archivo, setArchivo] = useState(null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef();

  async function submit(e) {
    e.preventDefault();
    if (!titulo.trim()) return;
    setLoading(true);
    const fd = new FormData();
    fd.append('titulo', titulo.trim());
    fd.append('descripcion', descripcion.trim());
    fd.append('tipo', tipo);
    fd.append('fecha_presentacion', fechaPres);
    if (archivo) fd.append('archivo', archivo);
    await api.uploadEscrito(expedienteId, fd);
    setLoading(false);
    onDone();
  }

  return (
    <div className="panel-body" style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg3)' }}>
      <form onSubmit={submit}>
        <div className="form-row">
          <div className="form-field">
            <label>Titulo</label>
            <input value={titulo} onChange={e => setTitulo(e.target.value)} required placeholder="Ej: Contestacion de demanda" />
          </div>
          <div className="form-field">
            <label>Tipo</label>
            <select value={tipo} onChange={e => setTipo(e.target.value)}>
              <option value="escrito">Escrito</option>
              <option value="demanda">Demanda</option>
              <option value="contestacion">Contestacion</option>
              <option value="recurso">Recurso</option>
              <option value="alegato">Alegato</option>
              <option value="prueba">Prueba</option>
              <option value="otro">Otro</option>
            </select>
          </div>
          <div className="form-field">
            <label>Fecha presentacion</label>
            <input type="date" value={fechaPres} onChange={e => setFechaPres(e.target.value)} />
          </div>
        </div>
        <div className="form-field">
          <label>Descripcion (opcional)</label>
          <input value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Detalles adicionales..." />
        </div>
        <div className="form-field">
          <label>Archivo (PDF, DOC, etc.)</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="file" ref={fileRef} onChange={e => setArchivo(e.target.files[0])} style={{ display: 'none' }} />
            <button type="button" className="btn-ghost" style={{ fontSize: 12, padding: '6px 12px' }} onClick={() => fileRef.current.click()}>
              <Upload size={13} /> {archivo ? archivo.name : 'Seleccionar archivo'}
            </button>
            {archivo && <span style={{ fontSize: 11, color: 'var(--text3)' }}>{(archivo.size / 1024).toFixed(0)} KB</span>}
          </div>
        </div>
        <button type="submit" className="btn-primary" style={{ fontSize: 12 }} disabled={loading || !titulo.trim()}>
          {loading ? 'Guardando...' : 'Guardar escrito'}
        </button>
      </form>
    </div>
  );
}

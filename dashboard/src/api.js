const BASE = (import.meta.env.VITE_API_URL || '') + '/api';

function getToken() {
  return localStorage.getItem('betti_token');
}

function setToken(token) {
  if (token) localStorage.setItem('betti_token', token);
  else localStorage.removeItem('betti_token');
}

function authHeaders(extra = {}) {
  const token = getToken();
  const headers = { ...extra };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

async function get(path) {
  const res = await fetch(`${BASE}${path}`, { headers: authHeaders() });
  if (res.status === 401) { window.dispatchEvent(new Event('betti:unauthorized')); throw new Error('No autorizado'); }
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

async function post(path, body) {
  const opts = { method: 'POST', headers: authHeaders() };
  if (body) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(`${BASE}${path}`, opts);
  if (res.status === 401) { window.dispatchEvent(new Event('betti:unauthorized')); throw new Error('No autorizado'); }
  return res.json();
}

async function put(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PUT',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  });
  if (res.status === 401) { window.dispatchEvent(new Event('betti:unauthorized')); throw new Error('No autorizado'); }
  return res.json();
}

async function patch(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PATCH',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  });
  if (res.status === 401) { window.dispatchEvent(new Event('betti:unauthorized')); throw new Error('No autorizado'); }
  return res.json();
}

async function del(path) {
  const res = await fetch(`${BASE}${path}`, { method: 'DELETE', headers: authHeaders() });
  if (res.status === 401) { window.dispatchEvent(new Event('betti:unauthorized')); throw new Error('No autorizado'); }
  return res.json();
}

export const auth = {
  status: () => fetch(`${BASE}/auth/status`, { headers: authHeaders() }).then(r => r.json()),
  login: (data) => post('/auth/login', data),
  logout: () => post('/auth/logout'),
  me: () => get('/auth/me'),
  changePassword: (data) => post('/auth/change-password', data),
  setToken,
  getToken,
};

export const api = {
  dashboard: () => get('/dashboard'),
  actividadHoy: () => get('/actividad/hoy'),
  actividadSemana: () => get('/actividad/semana'),
  alertas: () => get('/alertas'),
  expedientes: (params) => {
    const qs = params ? '?' + new URLSearchParams(params) : '';
    return get(`/expedientes${qs}`);
  },
  expediente: (id) => get(`/expedientes/${id}`),
  timeline: (id) => get(`/expedientes/${id}/timeline`),
  buscar: (q) => get(`/expedientes/buscar?q=${encodeURIComponent(q)}`),
  busquedaGlobal: (q) => get(`/buscar?q=${encodeURIComponent(q)}`),
  filtrar: (params) => get(`/expedientes/filtrar?${new URLSearchParams(params)}`),
  movidos: (dias = 7) => get(`/expedientes/movidos?dias=${dias}`),
  favoritos: () => get('/expedientes/favoritos'),
  toggleFavorito: (id) => post(`/expedientes/${id}/favorito`),
  getNotas: (expId) => get(`/expedientes/${expId}/notas`),
  addNota: (expId, texto) => post(`/expedientes/${expId}/notas`, { texto }),
  deleteNota: (id) => del(`/notas/${id}`),
  tareasStats: () => get('/tareas/stats'),
  tareasPendientes: () => get('/tareas/pendientes'),
  tareasVencidas: () => get('/tareas/vencidas'),
  tareasProximas: (dias = 7) => get(`/tareas/proximas?dias=${dias}`),
  tareasCalendario: (desde, hasta) => get(`/tareas/calendario?desde=${desde}&hasta=${hasta}`),
  tareasByExpediente: (expId) => get(`/expedientes/${expId}/tareas`),
  tarea: (id) => get(`/tareas/${id}`),
  crearTarea: (data) => post('/tareas', data),
  crearTareaDesdeRegla: (data) => post('/tareas/desde-regla', data),
  updateTarea: (id, data) => put(`/tareas/${id}`, data),
  cambiarEstadoTarea: (id, estado) => patch(`/tareas/${id}/estado`, { estado }),
  deleteTarea: (id) => del(`/tareas/${id}`),
  calcularVencimiento: (fecha_inicio, dias, tipo_plazo) => post('/calcular-vencimiento', { fecha_inicio, dias, tipo_plazo }),
  feriados: (params) => {
    const qs = params ? '?' + new URLSearchParams(params) : '';
    return get(`/feriados${qs}`);
  },
  addFeriado: (data) => post('/feriados', data),
  deleteFeriado: (id) => del(`/feriados/${id}`),
  reglasPlazos: () => get('/reglas-plazos'),
  eventos: (limit = 50) => get(`/eventos?limit=${limit}`),
  eventosHoy: () => get('/eventos/hoy'),
  actuacionesRecientes: (limit = 30) => get(`/actuaciones/recientes?limit=${limit}`),
  stats: () => get('/stats'),
  porDia: () => get('/stats/por-dia'),
  porSituacion: () => get('/stats/por-situacion'),
  porJurisdiccion: () => get('/stats/por-jurisdiccion'),
  porAnio: () => get('/stats/por-anio'),
  porDependencia: () => get('/stats/por-dependencia'),
  actividadSemanal: () => get('/stats/actividad-semanal'),
  getEscritos: (expId) => get(`/expedientes/${expId}/escritos`),
  uploadEscrito: async (expId, formData) => {
    const res = await fetch(`${BASE}/expedientes/${expId}/escritos`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${getToken()}` },
      body: formData,
    });
    return res.json();
  },
  deleteEscrito: (id) => del(`/escritos/${id}`),
  getBorradores: (expId) => get(`/expedientes/${expId}/borradores`),
  crearBorrador: (expId, data) => post(`/expedientes/${expId}/borradores`, data),
  updateBorrador: (id, data) => put(`/borradores/${id}`, data),
  deleteBorrador: (id) => del(`/borradores/${id}`),
  // Configuracion
  getConfig: () => get('/configuracion'),
  setConfig: (clave, valor) => put('/configuracion', { clave, valor }),
  setPjnCredentials: (usuario, password) => put('/configuracion/pjn', { usuario, password }),
  // Sistema
  jurisdicciones: () => get('/jurisdicciones'),
  logs: (limit = 10) => get(`/logs?limit=${limit}`),
  syncStatus: () => get('/sync-status'),
  scrape: () => post('/scrape'),
};

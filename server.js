const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { db, q, calcularVencimiento, hashPassword, verifyPassword, generateToken } = require("./db");
const { scrapeAll } = require("./scraper");

const app = express();
const PORT = process.env.PORT || 3000;
app.use(express.json());

// Multer for escrito uploads
const DATA_DIR = process.env.DATA_DIR || __dirname;
const escritosDir = path.join(DATA_DIR, "escritos");
if (!fs.existsSync(escritosDir)) fs.mkdirSync(escritosDir, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, escritosDir),
    filename: (req, file, cb) => {
      const ts = Date.now();
      const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
      cb(null, `${ts}_${safe}`);
    },
  }),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB max
});

// CORS for dev
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  next();
});

// Serve built dashboard in production
const dashboardPath = path.join(__dirname, "dashboard", "dist");
app.use(express.static(dashboardPath));

// ============================================================
// AUTH MIDDLEWARE
// ============================================================

function authMiddleware(req, res, next) {
  // Public routes
  if (req.path === '/api/auth/login' || req.path === '/api/auth/status') {
    return next();
  }
  // Skip auth for non-API routes (static files, SPA)
  if (!req.path.startsWith('/api/')) return next();

  const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token;
  if (!token) return res.status(401).json({ error: 'No autorizado' });

  const user = q.getUsuarioByToken.get(token);
  if (!user) return res.status(401).json({ error: 'Token inválido o expirado' });

  req.user = user;
  next();
}

app.use(authMiddleware);

// ============================================================
// AUTH ENDPOINTS
// ============================================================

// Check if setup is needed (no users exist)
app.get("/api/auth/status", (req, res) => {
  const count = db.prepare("SELECT COUNT(*) as c FROM usuarios").get().c;
  const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token;
  let user = null;
  if (token) user = q.getUsuarioByToken.get(token);
  res.json({ needsSetup: count === 0, authenticated: !!user, user });
});

// Login
app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email y password requeridos' });

  const user = q.getUsuarioByEmail.get(email.trim().toLowerCase());
  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'Credenciales incorrectas' });
  }

  const token = generateToken();
  q.updateToken.run(token, user.id);
  res.json({ ok: true, token, user: { id: user.id, email: user.email, nombre: user.nombre } });
});

// Logout
app.post("/api/auth/logout", (req, res) => {
  if (req.user) q.clearToken.run(req.user.id);
  res.json({ ok: true });
});

// Get current user
app.get("/api/auth/me", (req, res) => {
  res.json(req.user);
});

// Change password
app.post("/api/auth/change-password", (req, res) => {
  const { current_password, new_password } = req.body;
  if (!new_password || new_password.length < 4) return res.status(400).json({ error: 'Password min 4 chars' });

  const full = q.getUsuarioByEmail.get(req.user.email);
  if (!verifyPassword(current_password, full.password_hash)) {
    return res.status(401).json({ error: 'Password actual incorrecta' });
  }

  q.updatePassword.run(hashPassword(new_password), req.user.id);
  res.json({ ok: true });
});

// ============================================================
// CONFIGURACION (PJN credentials, etc)
// ============================================================

app.get("/api/configuracion", (req, res) => {
  const configs = q.getConfigAll.all(req.user.id);
  const result = {};
  for (const c of configs) {
    // Don't send PJN password in plain text
    if (c.clave === 'pjn_password') {
      result[c.clave] = c.valor ? '••••••••' : '';
    } else {
      result[c.clave] = c.valor;
    }
  }
  res.json(result);
});

app.put("/api/configuracion", (req, res) => {
  const { clave, valor } = req.body;
  if (!clave) return res.status(400).json({ error: 'Clave requerida' });
  q.setConfig.run(req.user.id, clave, valor || '');
  res.json({ ok: true });
});

app.put("/api/configuracion/pjn", (req, res) => {
  const { usuario, password } = req.body;
  if (!usuario?.trim()) return res.status(400).json({ error: 'Usuario PJN requerido' });
  q.setConfig.run(req.user.id, 'pjn_usuario', usuario.trim());
  if (password) q.setConfig.run(req.user.id, 'pjn_password', password);
  res.json({ ok: true });
});

// ============================================================
// API INDEX
// ============================================================

app.get("/api", (req, res) => {
  res.json({
    name: "PJN Scraper Argentina",
    version: "2.0",
    endpoints: {
      dashboard: {
        "GET /api/dashboard": "Resumen completo para frontend",
        "GET /api/actividad?desde=YYYY-MM-DD&hasta=YYYY-MM-DD": "Actividad por rango de fechas",
        "GET /api/actividad/hoy": "Qué se movió hoy",
        "GET /api/actividad/semana": "Qué se movió esta semana",
        "GET /api/alertas": "Expedientes que requieren atención (EN DESPACHO, GIRO)",
      },
      expedientes: {
        "GET /api/expedientes": "Todos los expedientes",
        "GET /api/expedientes/:id": "Detalle completo (actuaciones + eventos + partes + docs)",
        "GET /api/expedientes/:id/timeline": "Timeline unificado actuaciones + eventos",
        "GET /api/expedientes/buscar?q=texto": "Buscar por carátula o clave",
        "GET /api/expedientes/filtrar?jurisdiccion=&situacion=&anio=&dependencia=&q=": "Búsqueda avanzada",
        "GET /api/expedientes/movidos?dias=7": "Expedientes con movimiento reciente",
        "GET /api/expedientes/favoritos": "Expedientes marcados como favoritos",
        "POST /api/expedientes/:id/favorito": "Toggle favorito",
      },
      eventos: {
        "GET /api/eventos?limit=50": "Últimos eventos (cédulas + despachos)",
        "GET /api/eventos/hoy": "Eventos de hoy",
        "GET /api/eventos/:id": "Detalle de un evento",
      },
      actuaciones: {
        "GET /api/actuaciones/recientes?limit=30": "Últimas actuaciones",
      },
      stats: {
        "GET /api/stats": "Estadísticas generales",
        "GET /api/stats/por-dia": "Eventos por día",
        "GET /api/stats/por-situacion": "Expedientes por situación",
        "GET /api/stats/por-jurisdiccion": "Expedientes por jurisdicción",
        "GET /api/stats/por-anio": "Expedientes por año",
        "GET /api/stats/por-dependencia": "Expedientes por juzgado/sala",
        "GET /api/stats/actividad-semanal": "Actuaciones por semana",
      },
      sistema: {
        "GET /api/jurisdicciones": "Lista de jurisdicciones",
        "GET /api/logs?limit=10": "Logs de scraping",
        "POST /api/scrape": "Ejecutar scraping manual",
        "GET /api/pdfs/:filename": "Descargar PDF",
      },
    },
  });
});

// ============================================================
// DASHBOARD
// ============================================================

app.get("/api/dashboard", (req, res) => {
  const stats = q.stats.get();
  const ultimosEventos = q.getEventos.all(10);
  const porDia = q.eventosPorDia.all();
  const porSituacion = q.expedientesPorSituacion.all();
  const porJurisdiccion = q.expedientesPorJurisdiccion.all();
  const ultimosLogs = q.getLogs.all(5);
  const alertas = q.getAlertas.all();
  const actividadSemanal = q.actividadPorSemana.all();

  // Movimientos de hoy
  const hoy = new Date().toISOString().slice(0, 10);
  const movidosHoy = q.actividadPorFecha.all(hoy, hoy);

  res.json({
    stats,
    alertas: { total: alertas.length, expedientes: alertas },
    movidosHoy: { total: movidosHoy.length, actuaciones: movidosHoy },
    ultimosEventos,
    porDia,
    porSituacion,
    porJurisdiccion,
    actividadSemanal,
    ultimosLogs,
  });
});

// ============================================================
// ACTIVIDAD (movimientos)
// ============================================================

app.get("/api/actividad/hoy", (req, res) => {
  const hoy = new Date().toISOString().slice(0, 10);
  const actuaciones = q.actividadPorFecha.all(hoy, hoy);
  const eventos = q.getEventosHoy.all();
  res.json({
    fecha: hoy,
    actuaciones: { total: actuaciones.length, items: actuaciones },
    eventos: { total: eventos.length, items: eventos },
  });
});

app.get("/api/actividad/semana", (req, res) => {
  const hoy = new Date();
  const hace7 = new Date(hoy);
  hace7.setDate(hace7.getDate() - 7);
  const desde = hace7.toISOString().slice(0, 10);
  const hasta = hoy.toISOString().slice(0, 10);
  const actuaciones = q.actividadPorFecha.all(desde, hasta);

  // Agrupar por expediente
  const porExpediente = {};
  for (const act of actuaciones) {
    if (!porExpediente[act.clave]) {
      porExpediente[act.clave] = {
        clave: act.clave,
        caratula: act.caratula,
        situacion: act.situacion,
        dependencia: act.dependencia,
        actuaciones: [],
      };
    }
    porExpediente[act.clave].actuaciones.push(act);
  }

  res.json({
    desde,
    hasta,
    total_actuaciones: actuaciones.length,
    expedientes_movidos: Object.keys(porExpediente).length,
    porExpediente: Object.values(porExpediente),
  });
});

app.get("/api/actividad", (req, res) => {
  const hasta = req.query.hasta || new Date().toISOString().slice(0, 10);
  const desde = req.query.desde || (() => {
    const d = new Date(hasta);
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  })();
  const actuaciones = q.actividadPorFecha.all(desde, hasta);
  res.json({ desde, hasta, total: actuaciones.length, actuaciones });
});

// ============================================================
// ALERTAS
// ============================================================

app.get("/api/alertas", (req, res) => {
  const alertas = q.getAlertas.all();
  res.json({
    total: alertas.length,
    en_despacho: alertas.filter((a) => a.situacion === "EN DESPACHO"),
    en_giro: alertas.filter((a) => a.situacion === "GIRO"),
  });
});

// ============================================================
// EVENTOS
// ============================================================

app.get("/api/eventos/hoy", (req, res) => {
  res.json(q.getEventosHoy.all());
});

app.get("/api/eventos/:id", (req, res) => {
  const ev = q.getEventoById.get(req.params.id);
  if (!ev) return res.status(404).json({ error: "Evento no encontrado" });
  res.json(ev);
});

app.get("/api/eventos", (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  res.json(q.getEventos.all(limit));
});

// ============================================================
// EXPEDIENTES
// ============================================================

app.get("/api/expedientes/buscar", (req, res) => {
  const search = `%${req.query.q || ""}%`;
  res.json(q.buscarExpedientes.all(search, search));
});

app.get("/api/expedientes/filtrar", (req, res) => {
  const { jurisdiccion, situacion, dependencia, q: texto, anio } = req.query;
  const jur = jurisdiccion || null;
  const sit = situacion || null;
  const dep = dependencia ? `%${dependencia}%` : null;
  const txt = texto ? `%${texto}%` : null;
  const a = anio || null;
  res.json(q.buscarAvanzado.all(jur, jur, sit, sit, dep, dep, txt, txt, txt, a, a));
});

app.get("/api/expedientes/movidos", (req, res) => {
  const dias = parseInt(req.query.dias) || 7;
  res.json(q.expedientesMovidosReciente.all(`-${dias}`));
});

app.get("/api/expedientes/favoritos", (req, res) => {
  res.json(q.getExpedientesFavoritos.all());
});

app.get("/api/expedientes/:id/timeline", (req, res) => {
  const exp = q.getExpedienteById.get(req.params.id);
  if (!exp) return res.status(404).json({ error: "Expediente no encontrado" });
  const timeline = q.getTimelineByExpediente.all(exp.id, exp.clave);
  res.json({ expediente: exp, timeline });
});

app.get("/api/expedientes/:id", (req, res) => {
  const exp = q.getExpedienteById.get(req.params.id);
  if (!exp) return res.status(404).json({ error: "Expediente no encontrado" });
  const actuaciones = q.getActuacionesByExpediente.all(exp.id);
  const eventos = q.getEventosByExpediente.all(exp.clave);
  const partes = q.getPartesByExpediente.all(exp.id);
  const documentos = q.getDocumentosByExpediente.all(exp.id);
  res.json({ ...exp, actuaciones, eventos, partes, documentos });
});

app.get("/api/expedientes", (req, res) => {
  if (req.query.jurisdiccion) {
    return res.json(q.getExpedientesByJurisdiccion.all(req.query.jurisdiccion));
  }
  if (req.query.situacion) {
    return res.json(q.getExpedientesBySituacion.all(req.query.situacion));
  }
  res.json(q.getExpedientes.all());
});

app.post("/api/expedientes/:id/favorito", (req, res) => {
  const exp = q.getExpedienteById.get(req.params.id);
  if (!exp) return res.status(404).json({ error: "Expediente no encontrado" });
  q.toggleFavorito.run(exp.id);
  const updated = q.getExpedienteById.get(exp.id);
  res.json({ ok: true, favorito: updated.favorito });
});

// ============================================================
// ACTUACIONES
// ============================================================

app.get("/api/actuaciones/recientes", (req, res) => {
  const limit = parseInt(req.query.limit) || 30;
  res.json(q.getActuacionesRecientes.all(limit));
});

// ============================================================
// STATS
// ============================================================

app.get("/api/stats", (req, res) => {
  res.json(q.stats.get());
});

app.get("/api/stats/por-dia", (req, res) => {
  res.json(q.eventosPorDia.all());
});

app.get("/api/stats/por-situacion", (req, res) => {
  res.json(q.expedientesPorSituacion.all());
});

app.get("/api/stats/por-jurisdiccion", (req, res) => {
  res.json(q.expedientesPorJurisdiccion.all());
});

app.get("/api/stats/por-anio", (req, res) => {
  res.json(q.expedientesPorAnio.all());
});

app.get("/api/stats/por-dependencia", (req, res) => {
  res.json(q.expedientesPorDependencia.all());
});

app.get("/api/stats/actividad-semanal", (req, res) => {
  res.json(q.actividadPorSemana.all());
});

// ============================================================
// SISTEMA
// ============================================================

app.get("/api/jurisdicciones", (req, res) => {
  res.json(q.getJurisdicciones.all());
});

app.get("/api/logs", (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  res.json(q.getLogs.all(limit));
});

// Servir PDFs descargados
app.get("/api/pdfs/:filename", (req, res) => {
  const filePath = path.join(DATA_DIR, "pdfs", req.params.filename);
  res.sendFile(filePath, (err) => {
    if (err) res.status(404).json({ error: "PDF no encontrado" });
  });
});

// Búsqueda global
app.get("/api/buscar", (req, res) => {
  const s = `%${req.query.q || ""}%`;
  res.json(q.busquedaGlobal.all(s, s, s));
});

// Notas
app.get("/api/expedientes/:id/notas", (req, res) => {
  res.json(q.getNotasByExpediente.all(req.params.id));
});

app.post("/api/expedientes/:id/notas", (req, res) => {
  const { texto } = req.body;
  if (!texto?.trim()) return res.status(400).json({ error: "Texto requerido" });
  q.insertNota.run(req.params.id, texto.trim());
  res.json(q.getNotasByExpediente.all(req.params.id));
});

app.delete("/api/notas/:id", (req, res) => {
  q.deleteNota.run(req.params.id);
  res.json({ ok: true });
});

// Última sincronización
app.get("/api/sync-status", (req, res) => {
  const last = q.ultimoLog.get();
  res.json(last || { timestamp: null });
});

// ============================================================
// TAREAS / VENCIMIENTOS
// ============================================================

// Stats de tareas
app.get("/api/tareas/stats", (req, res) => {
  res.json(q.statsTareas.get());
});

// Tareas vencidas
app.get("/api/tareas/vencidas", (req, res) => {
  res.json(q.getTareasVencidas.all());
});

// Tareas próximas a vencer
app.get("/api/tareas/proximas", (req, res) => {
  const dias = req.query.dias || "7";
  res.json(q.getTareasProximas.all(dias));
});

// Tareas pendientes
app.get("/api/tareas/pendientes", (req, res) => {
  res.json(q.getTareasPendientes.all());
});

// Tareas para calendario (rango)
app.get("/api/tareas/calendario", (req, res) => {
  const desde = req.query.desde || new Date().toISOString().slice(0, 10);
  const hasta = req.query.hasta || (() => {
    const d = new Date(desde);
    d.setMonth(d.getMonth() + 2);
    return d.toISOString().slice(0, 10);
  })();
  const tareas = q.getTareasCalendario.all(desde, hasta);
  const feriados = q.getFeriadosByRango.all(desde, hasta);
  res.json({ tareas, feriados });
});

// Tareas por expediente
app.get("/api/expedientes/:id/tareas", (req, res) => {
  res.json(q.getTareasByExpediente.all(req.params.id));
});

// Detalle de tarea
app.get("/api/tareas/:id", (req, res) => {
  const t = q.getTareaById.get(req.params.id);
  if (!t) return res.status(404).json({ error: "Tarea no encontrada" });
  res.json(t);
});

// Crear tarea manual
app.post("/api/tareas", (req, res) => {
  const { expediente_id, titulo, descripcion, prioridad, fecha_inicio, dias_plazo, tipo_plazo, regla_id } = req.body;
  if (!titulo?.trim()) return res.status(400).json({ error: "Título requerido" });

  let diasFinal = dias_plazo;
  let tipoPlazoFinal = tipo_plazo || "habiles";
  let prioridadFinal = prioridad || "media";

  // Si se eligió una regla predefinida
  if (regla_id) {
    const regla = q.getReglaById.get(regla_id);
    if (regla) {
      diasFinal = regla.dias;
      tipoPlazoFinal = regla.tipo_plazo;
      prioridadFinal = prioridad || regla.prioridad_default;
    }
  }

  const inicio = fecha_inicio || new Date().toISOString().slice(0, 10);
  const vencimiento = diasFinal ? calcularVencimiento(inicio, diasFinal, tipoPlazoFinal) : null;

  const result = q.insertTarea.run(
    expediente_id || null, titulo.trim(), descripcion || null,
    "pendiente", prioridadFinal, inicio, vencimiento,
    diasFinal || null, tipoPlazoFinal, "manual", null
  );
  res.json(q.getTareaById.get(result.lastInsertRowid));
});

// Crear tarea desde regla de plazo (atajo)
app.post("/api/tareas/desde-regla", (req, res) => {
  const { regla_id, expediente_id, fecha_inicio } = req.body;
  const regla = q.getReglaById.get(regla_id);
  if (!regla) return res.status(404).json({ error: "Regla no encontrada" });

  const inicio = fecha_inicio || new Date().toISOString().slice(0, 10);
  const vencimiento = calcularVencimiento(inicio, regla.dias, regla.tipo_plazo);

  let titulo = regla.nombre;
  if (expediente_id) {
    const exp = q.getExpedienteById.get(expediente_id);
    if (exp) titulo = `${regla.nombre} — ${exp.clave}`;
  }

  const result = q.insertTarea.run(
    expediente_id || null, titulo, regla.descripcion,
    "pendiente", regla.prioridad_default, inicio, vencimiento,
    regla.dias, regla.tipo_plazo, "manual", null
  );
  res.json(q.getTareaById.get(result.lastInsertRowid));
});

// Actualizar tarea
app.put("/api/tareas/:id", (req, res) => {
  const t = q.getTareaById.get(req.params.id);
  if (!t) return res.status(404).json({ error: "Tarea no encontrada" });
  const { titulo, descripcion, estado, prioridad, fecha_vencimiento } = req.body;
  q.updateTarea.run(
    titulo || t.titulo, descripcion ?? t.descripcion,
    estado || t.estado, prioridad || t.prioridad,
    fecha_vencimiento || t.fecha_vencimiento,
    estado || t.estado, t.id
  );
  res.json(q.getTareaById.get(t.id));
});

// Cambiar estado rápido
app.patch("/api/tareas/:id/estado", (req, res) => {
  const { estado } = req.body;
  if (!["pendiente", "en_curso", "completada", "cancelada"].includes(estado)) {
    return res.status(400).json({ error: "Estado inválido" });
  }
  q.updateTareaEstado.run(estado, estado, req.params.id);
  res.json(q.getTareaById.get(req.params.id));
});

// Eliminar tarea
app.delete("/api/tareas/:id", (req, res) => {
  q.deleteTarea.run(req.params.id);
  res.json({ ok: true });
});

// Calcular vencimiento (utility endpoint)
app.post("/api/calcular-vencimiento", (req, res) => {
  const { fecha_inicio, dias, tipo_plazo } = req.body;
  if (!fecha_inicio || !dias) return res.status(400).json({ error: "fecha_inicio y dias requeridos" });
  const vencimiento = calcularVencimiento(fecha_inicio, parseInt(dias), tipo_plazo || "habiles");
  res.json({ fecha_inicio, dias, tipo_plazo: tipo_plazo || "habiles", vencimiento });
});

// ============================================================
// FERIADOS
// ============================================================

app.get("/api/feriados", (req, res) => {
  if (req.query.anio) return res.json(q.getFeriadosByAnio.all(parseInt(req.query.anio)));
  if (req.query.desde && req.query.hasta) return res.json(q.getFeriadosByRango.all(req.query.desde, req.query.hasta));
  res.json(q.getFeriados.all());
});

app.post("/api/feriados", (req, res) => {
  const { fecha, descripcion, tipo } = req.body;
  if (!fecha || !descripcion) return res.status(400).json({ error: "fecha y descripcion requeridos" });
  q.insertFeriadoManual.run(fecha, descripcion, tipo || "feriado", fecha);
  res.json({ ok: true });
});

app.delete("/api/feriados/:id", (req, res) => {
  q.deleteFeriado.run(req.params.id);
  res.json({ ok: true });
});

// ============================================================
// REGLAS DE PLAZOS
// ============================================================

app.get("/api/reglas-plazos", (req, res) => {
  res.json(q.getReglas.all());
});

// Scrape manual
app.post("/api/scrape", async (req, res) => {
  try {
    const result = await scrapeAll("MANUAL");
    res.json({ ok: true, ...result });
  } catch (err) {
    const needsConfig = err.message.includes('no configuradas') || err.message.includes('No hay usuarios');
    res.status(needsConfig ? 400 : 500).json({ ok: false, error: err.message, needsConfig });
  }
});

// ============================================================
// ESCRITOS (uploaded documents)
// ============================================================

app.get("/api/expedientes/:id/escritos", (req, res) => {
  res.json(q.getEscritosByExpediente.all(req.params.id));
});

app.post("/api/expedientes/:id/escritos", upload.single("archivo"), (req, res) => {
  const { titulo, descripcion, tipo, fecha_presentacion } = req.body;
  if (!titulo?.trim()) return res.status(400).json({ error: "Título requerido" });
  const file = req.file;
  q.insertEscrito.run(
    req.params.id,
    titulo.trim(),
    descripcion?.trim() || null,
    tipo || "escrito",
    file?.originalname || null,
    file?.filename || null,
    file?.size || null,
    fecha_presentacion || new Date().toISOString().slice(0, 10)
  );
  res.json(q.getEscritosByExpediente.all(req.params.id));
});

app.delete("/api/escritos/:id", (req, res) => {
  const escrito = q.getEscrito.get(req.params.id);
  if (escrito?.archivo_path) {
    const filePath = path.join(escritosDir, escrito.archivo_path);
    fs.unlink(filePath, () => {});
  }
  q.deleteEscrito.run(req.params.id);
  res.json({ ok: true });
});

app.get("/api/escritos/:filename", (req, res) => {
  const filePath = path.join(escritosDir, req.params.filename);
  res.sendFile(filePath, (err) => {
    if (err) res.status(404).json({ error: "Archivo no encontrado" });
  });
});

// ============================================================
// BORRADORES DE ESCRITOS (document generator)
// ============================================================

app.get("/api/expedientes/:id/borradores", (req, res) => {
  res.json(q.getBorradoresByExpediente.all(req.params.id));
});

app.post("/api/expedientes/:id/borradores", (req, res) => {
  const { titulo, tipo, contenido_html } = req.body;
  if (!titulo?.trim()) return res.status(400).json({ error: "Título requerido" });
  const result = q.insertBorrador.run(req.params.id, titulo.trim(), tipo || 'escrito', contenido_html || '');
  res.json(q.getBorrador.get(result.lastInsertRowid));
});

app.put("/api/borradores/:id", (req, res) => {
  const borrador = q.getBorrador.get(req.params.id);
  if (!borrador) return res.status(404).json({ error: "Borrador no encontrado" });
  const { titulo, tipo, contenido_html, estado } = req.body;
  q.updateBorrador.run(
    titulo || borrador.titulo,
    tipo || borrador.tipo,
    contenido_html ?? borrador.contenido_html,
    estado || borrador.estado,
    borrador.id
  );
  res.json(q.getBorrador.get(borrador.id));
});

app.delete("/api/borradores/:id", (req, res) => {
  q.deleteBorrador.run(req.params.id);
  res.json({ ok: true });
});

// Generate PDF from HTML content
app.post("/api/generar-pdf", async (req, res) => {
  const { html, titulo } = req.body;
  if (!html) return res.status(400).json({ error: "HTML requerido" });

  let browser;
  try {
    const { chromium } = require("playwright");
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    const fullHtml = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<style>
  @page { size: A4; margin: 5cm 2cm 2.5cm 5cm; }
  body { font-family: 'Times New Roman', Times, serif; font-size: 12pt; line-height: 1.8; color: #000; }
  h1 { font-size: 14pt; text-align: center; margin-bottom: 24pt; }
  h2 { font-size: 13pt; margin-top: 18pt; }
  p { text-indent: 2em; margin-bottom: 6pt; text-align: justify; }
  .header { text-align: right; margin-bottom: 24pt; font-size: 11pt; }
  .firma { margin-top: 48pt; text-align: center; }
  .proveer { margin-top: 24pt; text-align: center; font-weight: bold; font-style: italic; }
</style>
</head><body>${html}</body></html>`;

    await page.setContent(fullHtml, { waitUntil: 'networkidle' });
    const pdf = await page.pdf({ format: 'A4', margin: { top: '5cm', bottom: '2.5cm', left: '5cm', right: '2cm' }, printBackground: true });

    await browser.close();

    const safeName = (titulo || 'escrito').replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ\s_-]/g, '').replace(/\s+/g, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}.pdf"`);
    res.send(pdf);
  } catch (err) {
    if (browser) await browser.close().catch(() => {});
    res.status(500).json({ error: "Error generando PDF: " + err.message });
  }
});

// SPA fallback
app.get("*", (req, res) => {
  const index = path.join(dashboardPath, "index.html");
  res.sendFile(index, (err) => {
    if (err) res.status(404).json({ error: "Not found" });
  });
});

// ============================================================
// START
// ============================================================

// Auto-seed: create user + PJN config from env vars on first run
function seedFromEnv() {
  const count = db.prepare("SELECT COUNT(*) as c FROM usuarios").get().c;
  if (count > 0) return;

  const email = process.env.ADMIN_EMAIL;
  const pass = process.env.ADMIN_PASSWORD;
  const nombre = process.env.ADMIN_NOMBRE || 'Admin';
  const pjnUser = process.env.PJN_USUARIO;
  const pjnPass = process.env.PJN_PASSWORD;

  if (!email || !pass) return;

  const hash = hashPassword(pass);
  const result = q.insertUsuario.run(email.toLowerCase(), nombre, hash);
  const userId = result.lastInsertRowid;
  const token = generateToken();
  q.updateToken.run(token, userId);

  if (pjnUser) q.setConfig.run(userId, 'pjn_usuario', pjnUser);
  if (pjnPass) q.setConfig.run(userId, 'pjn_password', pjnPass);

  console.log(`[SEED] Usuario creado: ${email} | PJN: ${pjnUser ? 'configurado' : 'sin configurar'}`);
}

seedFromEnv();

app.listen(PORT, () => {
  console.log(`Betti API: http://localhost:${PORT}`);
  require("./cron");
});

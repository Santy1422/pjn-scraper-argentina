const Database = require("better-sqlite3");
const path = require("path");
const crypto = require("crypto");

const DATA_DIR = process.env.DATA_DIR || __dirname;
const db = new Database(path.join(DATA_DIR, "betti.db"));
db.pragma("journal_mode = WAL");

db.exec(`
  -- Jurisdicciones
  CREATE TABLE IF NOT EXISTS jurisdicciones (
    id INTEGER PRIMARY KEY,
    codigo TEXT NOT NULL UNIQUE,
    nombre TEXT NOT NULL,
    valor_scw TEXT NOT NULL UNIQUE
  );

  -- Expedientes
  CREATE TABLE IF NOT EXISTS expedientes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    clave TEXT NOT NULL UNIQUE,              -- "CNT 8893/2023"
    jurisdiccion_codigo TEXT,                -- CNT, CIV, COM...
    numero TEXT,
    anio TEXT,
    sufijo TEXT,                              -- CA1, CA2 (para apelaciones)
    dependencia TEXT,                         -- Juzgado/Sala
    caratula TEXT,
    situacion TEXT,                           -- EN LETRA, EN DESPACHO, GIRO...
    ultima_actuacion TEXT,                    -- Fecha ultima actuacion
    fecha_inicio TEXT,
    favorito INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  -- Eventos (del API api.pjn.gov.ar/eventos)
  CREATE TABLE IF NOT EXISTS eventos (
    id INTEGER PRIMARY KEY,                  -- ID del API PJN
    fecha_creacion INTEGER,                  -- timestamp ms
    fecha_accion INTEGER,
    tipo TEXT NOT NULL,                       -- cedula, despacho
    categoria TEXT,                           -- judicial
    app TEXT,                                 -- pjn-scw
    link_url TEXT,                            -- /consultaNovedad.seam?...
    has_document INTEGER DEFAULT 0,
    -- payload
    payload_id INTEGER,
    caratula_expediente TEXT,
    clave_expediente TEXT,                    -- CNT 8893/2023
    tipo_evento TEXT,                         -- cedula, despacho
    fecha_envio INTEGER,                      -- para cedulas
    fecha_firma INTEGER,                      -- para despachos
    cuil_destinatario TEXT,
    -- metadata
    pdf_descargado INTEGER DEFAULT 0,
    pdf_path TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- Actuaciones (del SCW - movimientos de cada expediente)
  CREATE TABLE IF NOT EXISTS actuaciones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    expediente_id INTEGER NOT NULL,
    oficina TEXT,
    fecha TEXT,
    fecha_iso TEXT,
    tipo TEXT,
    detalle TEXT,
    fojas TEXT,
    url_descarga TEXT,
    url_ver TEXT,
    hash TEXT UNIQUE,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (expediente_id) REFERENCES expedientes(id)
  );

  -- Partes
  CREATE TABLE IF NOT EXISTS partes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    expediente_id INTEGER NOT NULL,
    tipo TEXT NOT NULL,                       -- ACTOR, DEMANDADO, LETRADO
    nombre TEXT NOT NULL,
    cuit TEXT,
    matricula TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (expediente_id) REFERENCES expedientes(id)
  );

  -- Documentos descargados (PDFs)
  CREATE TABLE IF NOT EXISTS documentos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    evento_id INTEGER,
    expediente_id INTEGER,
    nombre TEXT,
    tipo_archivo TEXT DEFAULT 'PDF',
    url_origen TEXT,
    path_local TEXT,
    tamano_bytes INTEGER,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (expediente_id) REFERENCES expedientes(id)
  );

  -- Log de scraping
  CREATE TABLE IF NOT EXISTS scrape_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT DEFAULT (datetime('now')),
    tipo TEXT NOT NULL,
    eventos_nuevos INTEGER DEFAULT 0,
    expedientes_actualizados INTEGER DEFAULT 0,
    pdfs_descargados INTEGER DEFAULT 0,
    errores INTEGER DEFAULT 0,
    detalle TEXT,
    duracion_ms INTEGER
  );

  -- Notas por expediente
  CREATE TABLE IF NOT EXISTS notas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    expediente_id INTEGER NOT NULL,
    texto TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (expediente_id) REFERENCES expedientes(id)
  );

  -- Tareas / Vencimientos
  CREATE TABLE IF NOT EXISTS tareas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    expediente_id INTEGER,
    titulo TEXT NOT NULL,
    descripcion TEXT,
    estado TEXT NOT NULL DEFAULT 'pendiente',    -- pendiente, en_curso, completada, cancelada
    prioridad TEXT NOT NULL DEFAULT 'media',      -- critica, alta, media, baja
    fecha_inicio TEXT,
    fecha_vencimiento TEXT,                       -- fecha limite calculada
    dias_plazo INTEGER,                           -- plazo en dias habiles
    tipo_plazo TEXT DEFAULT 'habiles',            -- habiles, corridos
    origen TEXT,                                  -- manual, auto_cedula, auto_despacho, auto_traslado
    evento_id INTEGER,                            -- evento que generó la tarea (nullable)
    completada_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (expediente_id) REFERENCES expedientes(id)
  );

  -- Feriados judiciales
  CREATE TABLE IF NOT EXISTS feriados (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha TEXT NOT NULL UNIQUE,                   -- YYYY-MM-DD
    descripcion TEXT NOT NULL,
    tipo TEXT DEFAULT 'feriado',                  -- feriado, feria, asueto
    anio INTEGER
  );

  -- Reglas de plazos procesales (templates)
  CREATE TABLE IF NOT EXISTS reglas_plazos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    dias INTEGER NOT NULL,
    tipo_plazo TEXT DEFAULT 'habiles',            -- habiles, corridos
    prioridad_default TEXT DEFAULT 'alta',
    descripcion TEXT,
    activo INTEGER DEFAULT 1
  );

  -- Escritos (documentos subidos por el usuario)
  CREATE TABLE IF NOT EXISTS escritos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    expediente_id INTEGER NOT NULL,
    titulo TEXT NOT NULL,
    descripcion TEXT,
    tipo TEXT DEFAULT 'escrito',
    archivo_nombre TEXT,
    archivo_path TEXT,
    archivo_size INTEGER,
    fecha_presentacion TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (expediente_id) REFERENCES expedientes(id)
  );

  -- Borradores de escritos (document generator)
  CREATE TABLE IF NOT EXISTS borradores_escritos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    expediente_id INTEGER NOT NULL,
    titulo TEXT NOT NULL,
    tipo TEXT DEFAULT 'escrito',  -- escrito, demanda, contestacion, recurso, apelacion, alegato, prueba, pronto_despacho, revocatoria, generico
    contenido_html TEXT,
    estado TEXT DEFAULT 'borrador',  -- borrador, finalizado
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (expediente_id) REFERENCES expedientes(id)
  );

  -- Usuarios
  CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    nombre TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    token TEXT,
    token_expires TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    last_login TEXT
  );

  -- Configuracion (key-value per user, encrypted PJN creds etc)
  CREATE TABLE IF NOT EXISTS configuracion (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER NOT NULL,
    clave TEXT NOT NULL,
    valor TEXT,
    UNIQUE(usuario_id, clave),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
  );

  -- Indices
  CREATE INDEX IF NOT EXISTS idx_borradores_expediente ON borradores_escritos(expediente_id);
  CREATE INDEX IF NOT EXISTS idx_escritos_expediente ON escritos(expediente_id);
  CREATE INDEX IF NOT EXISTS idx_tareas_expediente ON tareas(expediente_id);
  CREATE INDEX IF NOT EXISTS idx_tareas_estado ON tareas(estado);
  CREATE INDEX IF NOT EXISTS idx_tareas_vencimiento ON tareas(fecha_vencimiento);
  CREATE INDEX IF NOT EXISTS idx_feriados_fecha ON feriados(fecha);
  CREATE INDEX IF NOT EXISTS idx_eventos_tipo ON eventos(tipo);
  CREATE INDEX IF NOT EXISTS idx_eventos_clave ON eventos(clave_expediente);
  CREATE INDEX IF NOT EXISTS idx_eventos_fecha ON eventos(fecha_creacion);
  CREATE INDEX IF NOT EXISTS idx_actuaciones_expediente ON actuaciones(expediente_id);
  CREATE INDEX IF NOT EXISTS idx_actuaciones_fecha ON actuaciones(fecha_iso);
  CREATE INDEX IF NOT EXISTS idx_expedientes_situacion ON expedientes(situacion);
`);

// Seed jurisdicciones
const jurisdiccionesData = [
  ["0", "CSJ", "Corte Suprema de Justicia de la Nación"],
  ["1", "CIV", "Cámara Nacional de Apelaciones en lo Civil"],
  ["2", "CAF", "Cámara Nac. Apelaciones Contencioso Administrativo Federal"],
  ["3", "CCF", "Cámara Nac. Apelaciones Civil y Comercial Federal"],
  ["4", "CNE", "Cámara Nacional Electoral"],
  ["5", "CSS", "Cámara Federal de la Seguridad Social"],
  ["6", "CPE", "Cámara Nac. Apelaciones Penal Económico"],
  ["7", "CNT", "Cámara Nacional de Apelaciones del Trabajo"],
  ["8", "CFP", "Cámara Criminal y Correccional Federal"],
  ["9", "CCC", "Cámara Nac. Apelaciones Criminal y Correccional"],
  ["10", "COM", "Cámara Nacional de Apelaciones en lo Comercial"],
  ["11", "CPF", "Cámara Federal de Casación Penal"],
  ["12", "CPN", "Cámara Nacional Casación Penal"],
  ["13", "FBB", "Justicia Federal de Bahía Blanca"],
  ["14", "FCR", "Justicia Federal de Comodoro Rivadavia"],
  ["15", "FCB", "Justicia Federal de Córdoba"],
  ["16", "FCT", "Justicia Federal de Corrientes"],
  ["17", "FGR", "Justicia Federal de General Roca"],
  ["18", "FLP", "Justicia Federal de La Plata"],
  ["19", "FMP", "Justicia Federal de Mar del Plata"],
  ["20", "FMZ", "Justicia Federal de Mendoza"],
  ["21", "FPO", "Justicia Federal de Posadas"],
  ["22", "FPA", "Justicia Federal de Paraná"],
  ["23", "FRE", "Justicia Federal de Resistencia"],
  ["24", "FSA", "Justicia Federal de Salta"],
  ["25", "FRO", "Justicia Federal de Rosario"],
  ["26", "FSM", "Justicia Federal de San Martín"],
  ["27", "FTU", "Justicia Federal de Tucumán"],
];

const insertJuris = db.prepare(
  "INSERT OR IGNORE INTO jurisdicciones (valor_scw, codigo, nombre) VALUES (?, ?, ?)"
);
for (const [v, c, n] of jurisdiccionesData) {
  insertJuris.run(v, c, n);
}

// Seed reglas de plazos procesales
const reglasData = [
  ["Contestar traslado de demanda (ordinario)", 15, "habiles", "alta", "Art. 356 CPCCN"],
  ["Contestar traslado de demanda (sumarísimo)", 5, "habiles", "critica", "Art. 498 CPCCN"],
  ["Apelar resolución", 5, "habiles", "critica", "Art. 244 CPCCN"],
  ["Expresión de agravios", 10, "habiles", "critica", "Art. 259 CPCCN - Cámara"],
  ["Contestar agravios", 10, "habiles", "alta", "Art. 259 CPCCN"],
  ["Oponer excepciones previas", 10, "habiles", "alta", "Art. 346 CPCCN"],
  ["Ofrecer prueba", 10, "habiles", "alta", "Art. 367 CPCCN"],
  ["Recurso extraordinario federal", 10, "habiles", "critica", "Art. 257 CPCCN"],
  ["Recurso de queja por denegación", 5, "habiles", "critica", "Art. 282 CPCCN"],
  ["Recurso de revocatoria/reposición", 3, "habiles", "alta", "Art. 239 CPCCN"],
  ["Contestar vista/traslado genérico", 5, "habiles", "alta", "Art. 150 CPCCN"],
  ["Recurso de aclaratoria", 3, "habiles", "media", "Art. 166 inc. 2 CPCCN"],
  ["Contestar cédula de notificación", 5, "habiles", "alta", "Plazo general para cédulas"],
  ["Alegar sobre prueba (ordinario)", 6, "habiles", "alta", "Art. 482 CPCCN"],
  ["Interponer incidente", 5, "habiles", "alta", "Art. 178 CPCCN"],
  ["Caducidad de instancia (1ra)", 180, "corridos", "media", "Art. 310 inc. 1 CPCCN - 6 meses"],
  ["Caducidad de instancia (2da)", 90, "corridos", "media", "Art. 310 inc. 2 CPCCN - 3 meses"],
  ["Caducidad de instancia (incidente)", 90, "corridos", "media", "Art. 310 inc. 3 CPCCN"],
];
// Add unique constraint if not exists
try { db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_reglas_nombre ON reglas_plazos(nombre)"); } catch(e) {}
const insertRegla = db.prepare(
  "INSERT OR IGNORE INTO reglas_plazos (nombre, dias, tipo_plazo, prioridad_default, descripcion) VALUES (?, ?, ?, ?, ?)"
);
for (const r of reglasData) insertRegla.run(...r);

// Seed feriados judiciales 2025-2026
const feriadosData = [
  // Feria judicial enero 2025
  ...Array.from({ length: 31 }, (_, i) => [`2025-01-${String(i + 1).padStart(2, "0")}`, "Feria judicial de enero", "feria"]),
  // Feriados nacionales 2025
  ["2025-02-28", "Viernes de Carnaval", "feriado"],
  ["2025-03-03", "Lunes de Carnaval", "feriado"],
  ["2025-03-04", "Martes de Carnaval", "feriado"],
  ["2025-03-24", "Día de la Memoria", "feriado"],
  ["2025-04-02", "Día del Veterano y de los Caídos en Malvinas", "feriado"],
  ["2025-04-17", "Jueves Santo", "feriado"],
  ["2025-04-18", "Viernes Santo", "feriado"],
  ["2025-05-01", "Día del Trabajador", "feriado"],
  ["2025-05-02", "Día del Trabajador Judicial", "feriado"],
  ["2025-05-25", "Revolución de Mayo", "feriado"],
  ["2025-06-16", "Paso a la Inmortalidad del Gral. Güemes", "feriado"],
  ["2025-06-20", "Paso a la Inmortalidad del Gral. Belgrano", "feriado"],
  ["2025-07-09", "Día de la Independencia", "feriado"],
  // Feria judicial julio 2025
  ...Array.from({ length: 14 }, (_, i) => [`2025-07-${String(i + 14).padStart(2, "0")}`, "Feria judicial de invierno", "feria"]),
  ["2025-08-17", "Paso a la Inmortalidad del Gral. San Martín", "feriado"],
  ["2025-09-24", "Día de la Justicia", "feriado"],
  ["2025-10-12", "Día del Respeto a la Diversidad Cultural", "feriado"],
  ["2025-11-20", "Día de la Soberanía Nacional", "feriado"],
  ["2025-12-08", "Inmaculada Concepción", "feriado"],
  ["2025-12-25", "Navidad", "feriado"],
  // Feria judicial enero 2026
  ...Array.from({ length: 31 }, (_, i) => [`2026-01-${String(i + 1).padStart(2, "0")}`, "Feria judicial de enero", "feria"]),
  // Feriados nacionales 2026
  ["2026-02-16", "Lunes de Carnaval", "feriado"],
  ["2026-02-17", "Martes de Carnaval", "feriado"],
  ["2026-03-24", "Día de la Memoria", "feriado"],
  ["2026-04-02", "Día del Veterano y de los Caídos en Malvinas", "feriado"],
  ["2026-04-02", "Jueves Santo", "feriado"],
  ["2026-04-03", "Viernes Santo", "feriado"],
  ["2026-05-01", "Día del Trabajador", "feriado"],
  ["2026-05-04", "Día del Trabajador Judicial", "feriado"],
  ["2026-05-25", "Revolución de Mayo", "feriado"],
  ["2026-06-15", "Paso a la Inmortalidad del Gral. Güemes", "feriado"],
  ["2026-06-20", "Paso a la Inmortalidad del Gral. Belgrano", "feriado"],
  ["2026-07-09", "Día de la Independencia", "feriado"],
  ["2026-07-13", "Inicio feria de invierno", "feria"],
  ...Array.from({ length: 14 }, (_, i) => [`2026-07-${String(i + 13).padStart(2, "0")}`, "Feria judicial de invierno", "feria"]),
  ["2026-08-17", "Paso a la Inmortalidad del Gral. San Martín", "feriado"],
  ["2026-09-24", "Día de la Justicia", "feriado"],
  ["2026-10-12", "Día del Respeto a la Diversidad Cultural", "feriado"],
  ["2026-11-20", "Día de la Soberanía Nacional", "feriado"],
  ["2026-12-08", "Inmaculada Concepción", "feriado"],
  ["2026-12-25", "Navidad", "feriado"],
];
const insertFeriado = db.prepare(
  "INSERT OR IGNORE INTO feriados (fecha, descripcion, tipo, anio) VALUES (?, ?, ?, CAST(substr(?, 1, 4) AS INTEGER))"
);
for (const [f, d, t] of feriadosData) insertFeriado.run(f, d, t, f);

// Queries
const q = {
  // Eventos
  insertEvento: db.prepare(`
    INSERT OR IGNORE INTO eventos
    (id, fecha_creacion, fecha_accion, tipo, categoria, app, link_url, has_document,
     payload_id, caratula_expediente, clave_expediente, tipo_evento,
     fecha_envio, fecha_firma, cuil_destinatario)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  getEventos: db.prepare(
    "SELECT * FROM eventos ORDER BY fecha_creacion DESC LIMIT ?"
  ),
  getEventosHoy: db.prepare(`
    SELECT * FROM eventos
    WHERE date(fecha_creacion/1000, 'unixepoch', '-3 hours') = date('now', '-3 hours')
    ORDER BY fecha_creacion DESC
  `),
  getEventoById: db.prepare("SELECT * FROM eventos WHERE id = ?"),
  marcarPdfDescargado: db.prepare(
    "UPDATE eventos SET pdf_descargado = 1, pdf_path = ? WHERE id = ?"
  ),

  // Expedientes
  upsertExpediente: db.prepare(`
    INSERT INTO expedientes (clave, jurisdiccion_codigo, numero, anio, sufijo, dependencia, caratula, situacion, ultima_actuacion, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(clave) DO UPDATE SET
      dependencia = excluded.dependencia,
      caratula = excluded.caratula,
      situacion = excluded.situacion,
      ultima_actuacion = excluded.ultima_actuacion,
      updated_at = datetime('now')
  `),
  getExpedientes: db.prepare(
    "SELECT * FROM expedientes ORDER BY updated_at DESC"
  ),
  getExpedienteById: db.prepare("SELECT * FROM expedientes WHERE id = ?"),
  getExpedienteByClave: db.prepare("SELECT * FROM expedientes WHERE clave = ?"),
  buscarExpedientes: db.prepare(
    "SELECT * FROM expedientes WHERE caratula LIKE ? OR clave LIKE ? ORDER BY updated_at DESC LIMIT 50"
  ),

  // Actuaciones
  insertActuacion: db.prepare(`
    INSERT OR IGNORE INTO actuaciones
    (expediente_id, oficina, fecha, fecha_iso, tipo, detalle, fojas, url_descarga, url_ver, hash)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  getActuacionesByExpediente: db.prepare(
    "SELECT * FROM actuaciones WHERE expediente_id = ? ORDER BY fecha_iso DESC, id DESC"
  ),
  getActuacionesRecientes: db.prepare(`
    SELECT a.*, e.clave, e.caratula, e.situacion, e.dependencia
    FROM actuaciones a JOIN expedientes e ON a.expediente_id = e.id
    ORDER BY a.fecha_iso DESC, a.id DESC LIMIT ?
  `),
  getActuacionesRecientesPorDias: db.prepare(`
    SELECT a.*, e.clave, e.caratula, e.situacion, e.dependencia
    FROM actuaciones a JOIN expedientes e ON a.expediente_id = e.id
    WHERE a.fecha_iso >= date('now', ? || ' days')
    ORDER BY a.fecha_iso DESC, a.id DESC
  `),

  // Partes
  insertParte: db.prepare(
    "INSERT INTO partes (expediente_id, tipo, nombre, cuit, matricula) VALUES (?, ?, ?, ?, ?)"
  ),
  getPartesByExpediente: db.prepare(
    "SELECT * FROM partes WHERE expediente_id = ?"
  ),

  // Documentos
  insertDocumento: db.prepare(
    "INSERT INTO documentos (evento_id, expediente_id, nombre, url_origen, path_local, tamano_bytes) VALUES (?, ?, ?, ?, ?, ?)"
  ),

  // Logs
  insertLog: db.prepare(
    "INSERT INTO scrape_logs (tipo, eventos_nuevos, expedientes_actualizados, pdfs_descargados, errores, detalle, duracion_ms) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ),
  getLogs: db.prepare("SELECT * FROM scrape_logs ORDER BY timestamp DESC LIMIT ?"),

  // Dashboard stats
  stats: db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM expedientes) as total_expedientes,
      (SELECT COUNT(*) FROM expedientes WHERE situacion = 'EN LETRA') as en_letra,
      (SELECT COUNT(*) FROM expedientes WHERE situacion = 'EN DESPACHO') as en_despacho,
      (SELECT COUNT(*) FROM eventos) as total_eventos,
      (SELECT COUNT(*) FROM eventos WHERE tipo = 'cedula') as cedulas,
      (SELECT COUNT(*) FROM eventos WHERE tipo = 'despacho') as despachos,
      (SELECT COUNT(*) FROM documentos) as total_documentos,
      (SELECT COUNT(*) FROM actuaciones) as total_actuaciones
  `),
  eventosPorDia: db.prepare(`
    SELECT date(fecha_creacion/1000, 'unixepoch', '-3 hours') as dia, tipo, COUNT(*) as cantidad
    FROM eventos
    GROUP BY dia, tipo
    ORDER BY dia DESC
    LIMIT 60
  `),
  expedientesPorSituacion: db.prepare(`
    SELECT situacion, COUNT(*) as cantidad
    FROM expedientes WHERE situacion IS NOT NULL
    GROUP BY situacion ORDER BY cantidad DESC
  `),

  // Jurisdicciones
  getJurisdicciones: db.prepare("SELECT * FROM jurisdicciones ORDER BY codigo"),

  // --- LexDoctor-style queries ---

  // Expedientes con filtros
  getExpedientesByJurisdiccion: db.prepare(
    "SELECT * FROM expedientes WHERE jurisdiccion_codigo = ? ORDER BY updated_at DESC"
  ),
  getExpedientesBySituacion: db.prepare(
    "SELECT * FROM expedientes WHERE situacion = ? ORDER BY updated_at DESC"
  ),
  getExpedientesFavoritos: db.prepare(
    "SELECT * FROM expedientes WHERE favorito = 1 ORDER BY updated_at DESC"
  ),
  toggleFavorito: db.prepare(
    "UPDATE expedientes SET favorito = CASE WHEN favorito = 1 THEN 0 ELSE 1 END WHERE id = ?"
  ),

  // Movimientos recientes (expedientes que se movieron en N dias)
  expedientesMovidosReciente: db.prepare(`
    SELECT DISTINCT e.*,
      (SELECT COUNT(*) FROM actuaciones a2 WHERE a2.expediente_id = e.id) as total_actuaciones,
      (SELECT MAX(a3.fecha_iso) FROM actuaciones a3 WHERE a3.expediente_id = e.id) as ultima_actuacion_iso
    FROM expedientes e
    JOIN actuaciones a ON a.expediente_id = e.id
    WHERE a.fecha_iso >= date('now', ? || ' days')
    ORDER BY a.fecha_iso DESC
  `),

  // Timeline: actuaciones + eventos merged por expediente
  getTimelineByExpediente: db.prepare(`
    SELECT 'actuacion' as origen, a.id, a.fecha_iso as fecha, a.tipo, a.detalle as descripcion,
           a.oficina, a.fojas, a.url_descarga, NULL as pdf_path
    FROM actuaciones a WHERE a.expediente_id = ?
    UNION ALL
    SELECT 'evento' as origen, ev.id, date(ev.fecha_creacion/1000, 'unixepoch', '-3 hours') as fecha,
           ev.tipo, ev.caratula_expediente as descripcion,
           NULL as oficina, NULL as fojas, NULL as url_descarga, ev.pdf_path
    FROM eventos ev WHERE ev.clave_expediente = ?
    ORDER BY fecha DESC
  `),

  // Eventos por expediente
  getEventosByExpediente: db.prepare(
    "SELECT * FROM eventos WHERE clave_expediente = ? ORDER BY fecha_creacion DESC"
  ),

  // Documentos por expediente
  getDocumentosByExpediente: db.prepare(
    "SELECT * FROM documentos WHERE expediente_id = ? ORDER BY created_at DESC"
  ),

  // Actividad reciente: que se movio hoy/ayer/esta semana
  actividadPorFecha: db.prepare(`
    SELECT a.*, e.clave, e.caratula, e.situacion, e.dependencia
    FROM actuaciones a JOIN expedientes e ON a.expediente_id = e.id
    WHERE a.fecha_iso >= ? AND a.fecha_iso <= ?
    ORDER BY a.fecha_iso DESC, a.id DESC
  `),

  // Expedientes por jurisdiccion agrupados
  expedientesPorJurisdiccion: db.prepare(`
    SELECT jurisdiccion_codigo, COUNT(*) as cantidad
    FROM expedientes WHERE jurisdiccion_codigo IS NOT NULL
    GROUP BY jurisdiccion_codigo ORDER BY cantidad DESC
  `),

  // Expedientes por año
  expedientesPorAnio: db.prepare(`
    SELECT anio, COUNT(*) as cantidad
    FROM expedientes WHERE anio IS NOT NULL
    GROUP BY anio ORDER BY anio DESC
  `),

  // Expedientes por dependencia (juzgado/sala)
  expedientesPorDependencia: db.prepare(`
    SELECT dependencia, COUNT(*) as cantidad
    FROM expedientes WHERE dependencia IS NOT NULL
    GROUP BY dependencia ORDER BY cantidad DESC
  `),

  // Búsqueda avanzada
  buscarAvanzado: db.prepare(`
    SELECT e.*,
      (SELECT COUNT(*) FROM actuaciones a WHERE a.expediente_id = e.id) as total_actuaciones,
      (SELECT COUNT(*) FROM eventos ev WHERE ev.clave_expediente = e.clave) as total_eventos
    FROM expedientes e
    WHERE (? IS NULL OR e.jurisdiccion_codigo = ?)
      AND (? IS NULL OR e.situacion = ?)
      AND (? IS NULL OR e.dependencia LIKE ?)
      AND (? IS NULL OR e.caratula LIKE ? OR e.clave LIKE ?)
      AND (? IS NULL OR e.anio = ?)
    ORDER BY e.updated_at DESC
    LIMIT 100
  `),

  // Alertas: expedientes en despacho (necesitan atencion)
  getAlertas: db.prepare(`
    SELECT e.*,
      (SELECT MAX(a.fecha_iso) FROM actuaciones a WHERE a.expediente_id = e.id) as ultima_actuacion_iso
    FROM expedientes e
    WHERE e.situacion IN ('EN DESPACHO', 'GIRO')
    ORDER BY e.updated_at DESC
  `),

  // Conteo de actividad por semana
  actividadPorSemana: db.prepare(`
    SELECT strftime('%Y-W%W', fecha_iso) as semana, COUNT(*) as cantidad
    FROM actuaciones WHERE fecha_iso IS NOT NULL
    GROUP BY semana ORDER BY semana DESC LIMIT 20
  `),

  // Notas
  insertNota: db.prepare(
    "INSERT INTO notas (expediente_id, texto) VALUES (?, ?)"
  ),
  getNotasByExpediente: db.prepare(
    "SELECT * FROM notas WHERE expediente_id = ? ORDER BY created_at DESC"
  ),
  deleteNota: db.prepare("DELETE FROM notas WHERE id = ?"),

  // Escritos
  insertEscrito: db.prepare(
    "INSERT INTO escritos (expediente_id, titulo, descripcion, tipo, archivo_nombre, archivo_path, archivo_size, fecha_presentacion) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  ),
  getEscritosByExpediente: db.prepare(
    "SELECT * FROM escritos WHERE expediente_id = ? ORDER BY created_at DESC"
  ),
  deleteEscrito: db.prepare("DELETE FROM escritos WHERE id = ?"),
  getEscrito: db.prepare("SELECT * FROM escritos WHERE id = ?"),

  // Borradores de escritos
  insertBorrador: db.prepare("INSERT INTO borradores_escritos (expediente_id, titulo, tipo, contenido_html) VALUES (?, ?, ?, ?)"),
  updateBorrador: db.prepare("UPDATE borradores_escritos SET titulo=?, tipo=?, contenido_html=?, estado=?, updated_at=datetime('now') WHERE id=?"),
  getBorradoresByExpediente: db.prepare("SELECT * FROM borradores_escritos WHERE expediente_id = ? ORDER BY updated_at DESC"),
  getBorrador: db.prepare("SELECT * FROM borradores_escritos WHERE id = ?"),
  deleteBorrador: db.prepare("DELETE FROM borradores_escritos WHERE id = ?"),

  // Búsqueda global rápida (top 15)
  busquedaGlobal: db.prepare(`
    SELECT id, clave, caratula, situacion, jurisdiccion_codigo, dependencia
    FROM expedientes
    WHERE caratula LIKE ? OR clave LIKE ? OR dependencia LIKE ?
    ORDER BY updated_at DESC LIMIT 15
  `),

  // Última sincronización
  ultimoLog: db.prepare("SELECT * FROM scrape_logs ORDER BY timestamp DESC LIMIT 1"),

  // --- Tareas y Calendario ---

  // Tareas CRUD
  insertTarea: db.prepare(`
    INSERT INTO tareas (expediente_id, titulo, descripcion, estado, prioridad, fecha_inicio, fecha_vencimiento, dias_plazo, tipo_plazo, origen, evento_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  updateTarea: db.prepare(`
    UPDATE tareas SET titulo=?, descripcion=?, estado=?, prioridad=?, fecha_vencimiento=?,
    updated_at=datetime('now'), completada_at=CASE WHEN ?='completada' THEN datetime('now') ELSE completada_at END
    WHERE id=?
  `),
  updateTareaEstado: db.prepare(`
    UPDATE tareas SET estado=?, updated_at=datetime('now'),
    completada_at=CASE WHEN ?='completada' THEN datetime('now') ELSE NULL END
    WHERE id=?
  `),
  deleteTarea: db.prepare("DELETE FROM tareas WHERE id=?"),
  getTareaById: db.prepare("SELECT t.*, e.clave, e.caratula FROM tareas t LEFT JOIN expedientes e ON t.expediente_id = e.id WHERE t.id=?"),

  // Tareas por expediente
  getTareasByExpediente: db.prepare(
    "SELECT * FROM tareas WHERE expediente_id=? ORDER BY CASE estado WHEN 'pendiente' THEN 0 WHEN 'en_curso' THEN 1 ELSE 2 END, fecha_vencimiento ASC"
  ),

  // Todas las tareas pendientes
  getTareasPendientes: db.prepare(`
    SELECT t.*, e.clave, e.caratula
    FROM tareas t LEFT JOIN expedientes e ON t.expediente_id = e.id
    WHERE t.estado IN ('pendiente', 'en_curso')
    ORDER BY t.fecha_vencimiento ASC
  `),

  // Tareas vencidas
  getTareasVencidas: db.prepare(`
    SELECT t.*, e.clave, e.caratula
    FROM tareas t LEFT JOIN expedientes e ON t.expediente_id = e.id
    WHERE t.estado IN ('pendiente', 'en_curso') AND t.fecha_vencimiento < date('now')
    ORDER BY t.fecha_vencimiento ASC
  `),

  // Tareas próximas a vencer (N días)
  getTareasProximas: db.prepare(`
    SELECT t.*, e.clave, e.caratula
    FROM tareas t LEFT JOIN expedientes e ON t.expediente_id = e.id
    WHERE t.estado IN ('pendiente', 'en_curso')
      AND t.fecha_vencimiento >= date('now')
      AND t.fecha_vencimiento <= date('now', ? || ' days')
    ORDER BY t.fecha_vencimiento ASC
  `),

  // Todas las tareas para calendario (rango de fechas)
  getTareasCalendario: db.prepare(`
    SELECT t.*, e.clave, e.caratula
    FROM tareas t LEFT JOIN expedientes e ON t.expediente_id = e.id
    WHERE t.fecha_vencimiento >= ? AND t.fecha_vencimiento <= ?
    ORDER BY t.fecha_vencimiento ASC
  `),

  // Feriados
  getFeriados: db.prepare("SELECT * FROM feriados ORDER BY fecha"),
  getFeriadosByRango: db.prepare("SELECT * FROM feriados WHERE fecha >= ? AND fecha <= ? ORDER BY fecha"),
  getFeriadosByAnio: db.prepare("SELECT * FROM feriados WHERE anio = ? ORDER BY fecha"),
  insertFeriadoManual: db.prepare("INSERT OR IGNORE INTO feriados (fecha, descripcion, tipo, anio) VALUES (?, ?, ?, CAST(substr(?, 1, 4) AS INTEGER))"),
  deleteFeriado: db.prepare("DELETE FROM feriados WHERE id=?"),
  isFeriado: db.prepare("SELECT COUNT(*) as es_feriado FROM feriados WHERE fecha = ?"),

  // Reglas de plazos
  getReglas: db.prepare("SELECT * FROM reglas_plazos WHERE activo = 1 ORDER BY nombre"),
  getReglaById: db.prepare("SELECT * FROM reglas_plazos WHERE id = ?"),

  // Usuarios
  insertUsuario: db.prepare("INSERT INTO usuarios (email, nombre, password_hash) VALUES (?, ?, ?)"),
  getUsuarioByEmail: db.prepare("SELECT * FROM usuarios WHERE email = ?"),
  getUsuarioById: db.prepare("SELECT id, email, nombre, created_at, last_login FROM usuarios WHERE id = ?"),
  getUsuarioByToken: db.prepare("SELECT id, email, nombre, created_at, last_login FROM usuarios WHERE token = ? AND token_expires > datetime('now')"),
  updateToken: db.prepare("UPDATE usuarios SET token = ?, token_expires = datetime('now', '+30 days'), last_login = datetime('now') WHERE id = ?"),
  clearToken: db.prepare("UPDATE usuarios SET token = NULL, token_expires = NULL WHERE id = ?"),
  updatePassword: db.prepare("UPDATE usuarios SET password_hash = ? WHERE id = ?"),
  getUsuarios: db.prepare("SELECT id, email, nombre, created_at, last_login FROM usuarios ORDER BY created_at"),

  // Configuracion
  setConfig: db.prepare("INSERT INTO configuracion (usuario_id, clave, valor) VALUES (?, ?, ?) ON CONFLICT(usuario_id, clave) DO UPDATE SET valor = excluded.valor"),
  getConfig: db.prepare("SELECT valor FROM configuracion WHERE usuario_id = ? AND clave = ?"),
  getConfigAll: db.prepare("SELECT clave, valor FROM configuracion WHERE usuario_id = ?"),
  deleteConfig: db.prepare("DELETE FROM configuracion WHERE usuario_id = ? AND clave = ?"),

  // Stats de tareas
  statsTareas: db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM tareas WHERE estado = 'pendiente') as pendientes,
      (SELECT COUNT(*) FROM tareas WHERE estado = 'en_curso') as en_curso,
      (SELECT COUNT(*) FROM tareas WHERE estado = 'completada') as completadas,
      (SELECT COUNT(*) FROM tareas WHERE estado IN ('pendiente','en_curso') AND fecha_vencimiento < date('now')) as vencidas,
      (SELECT COUNT(*) FROM tareas WHERE estado IN ('pendiente','en_curso') AND fecha_vencimiento >= date('now') AND fecha_vencimiento <= date('now', '+3 days')) as proximas_3d
  `),
};

function fechaToISO(fecha) {
  if (!fecha) return null;
  const parts = fecha.split("/");
  if (parts.length !== 3) return null;
  return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
}

function hashActuacion(expedienteId, fecha, tipo, oficina, detalle) {
  return crypto
    .createHash("md5")
    .update(`${expedienteId}|${fecha}|${tipo}|${oficina}|${detalle}`)
    .digest("hex");
}

function parseClave(clave) {
  // "CNT 8893/2023" -> { codigo: "CNT", numero: "8893", anio: "2023", sufijo: null }
  // "CNT 072197/2014/CA1" -> { codigo: "CNT", numero: "72197", anio: "2014", sufijo: "CA1" }
  const match = clave.match(/^(\w+)\s+(\d+)\/(\d+)(?:\/(\w+))?$/);
  if (!match) return { codigo: null, numero: null, anio: null, sufijo: null };
  // Quitar ceros a la izquierda del número
  return { codigo: match[1], numero: match[2].replace(/^0+/, ""), anio: match[3], sufijo: match[4] || null };
}

// Normalizar clave: "CNT 008893/2023" -> "CNT 8893/2023"
function normalizarClave(clave) {
  return clave.replace(/^(\w+)\s+0*(\d+)/, "$1 $2");
}

// Calcular fecha de vencimiento sumando días hábiles judiciales
function calcularVencimiento(fechaInicio, diasPlazo, tipoPlazo = "habiles") {
  const feriadosSet = new Set(
    q.getFeriados.all().map((f) => f.fecha)
  );

  let fecha = new Date(fechaInicio + "T12:00:00");
  // El plazo empieza a correr desde el día siguiente a la notificación
  fecha.setDate(fecha.getDate() + 1);

  if (tipoPlazo === "corridos") {
    fecha.setDate(fecha.getDate() + diasPlazo - 1);
    // Si cae en día inhábil, se extiende al siguiente hábil
    while (esInhabil(fecha, feriadosSet)) {
      fecha.setDate(fecha.getDate() + 1);
    }
  } else {
    // Días hábiles
    let contados = 0;
    while (contados < diasPlazo) {
      if (!esInhabil(fecha, feriadosSet)) {
        contados++;
      }
      if (contados < diasPlazo) {
        fecha.setDate(fecha.getDate() + 1);
      }
    }
  }
  return fecha.toISOString().slice(0, 10);
}

function esInhabil(fecha, feriadosSet) {
  const dia = fecha.getDay(); // 0=dom, 6=sab
  if (dia === 0 || dia === 6) return true;
  const iso = fecha.toISOString().slice(0, 10);
  return feriadosSet.has(iso);
}

// Auth helpers
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const test = crypto.scryptSync(password, salt, 64).toString('hex');
  return hash === test;
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

module.exports = { db, q, fechaToISO, hashActuacion, parseClave, normalizarClave, calcularVencimiento, hashPassword, verifyPassword, generateToken };

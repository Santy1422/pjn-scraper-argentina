const { chromium } = require("playwright");
const { db, q, fechaToISO, hashActuacion, parseClave, normalizarClave, calcularVencimiento } = require("./db");
const fs = require("fs");
const path = require("path");

// Get PJN credentials from DB (first user's config)
function getCredentials() {
  const user = db.prepare("SELECT id FROM usuarios ORDER BY id LIMIT 1").get();
  if (!user) throw new Error("No hay usuarios configurados");
  const usuario = db.prepare("SELECT valor FROM configuracion WHERE usuario_id = ? AND clave = 'pjn_usuario'").get(user.id);
  const password = db.prepare("SELECT valor FROM configuracion WHERE usuario_id = ? AND clave = 'pjn_password'").get(user.id);
  if (!usuario?.valor || !password?.valor) throw new Error("Credenciales PJN no configuradas. Ve a Configuracion para ingresarlas.");
  return { usuario: usuario.valor, password: password.valor };
}

const DATA_DIR = process.env.DATA_DIR || __dirname;
const PDF_DIR = path.join(DATA_DIR, "pdfs");
if (!fs.existsSync(PDF_DIR)) fs.mkdirSync(PDF_DIR);

// ============================================================
// AUTH
// ============================================================

async function loginYObtenerContexto() {
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-extensions',
      '--disable-background-networking',
      '--single-process',
      '--memory-pressure-off',
      '--js-flags=--max-old-space-size=256',
    ],
  });
  const context = await browser.newContext({
    viewport: { width: 1400, height: 1000 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  });
  const page = await context.newPage();

  console.log("[AUTH] Login en portal PJN...");
  await page.goto("https://portalpjn.pjn.gov.ar/", {
    waitUntil: "networkidle",
    timeout: 30000,
  });
  await page.waitForTimeout(2000);
  const CREDENTIALS = getCredentials();
  await page.fill("#username", CREDENTIALS.usuario);
  await page.fill("#password", CREDENTIALS.password);
  await page.click("#kc-login");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(3000);

  const tokenData = await page.evaluate(() => {
    const raw = sessionStorage.getItem(
      "oidc.user:https://sso.pjn.gov.ar/auth/realms/pjn:pjn-portal"
    );
    return raw ? JSON.parse(raw) : null;
  });

  if (!tokenData?.access_token) {
    throw new Error("No se pudo obtener token de acceso");
  }

  console.log("[AUTH] Token obtenido OK");
  return { browser, context, page, token: tokenData.access_token };
}

// ============================================================
// 1. EVENTOS via API REST
// ============================================================

// Auto-crear tareas desde eventos nuevos
function crearTareaAutomatica(ev) {
  try {
    const clave = ev.payload?.claveExpediente;
    if (!clave) return;

    // Buscar el expediente
    const claveNorm = normalizarClave(clave);
    const exp = q.getExpedienteByClave.get(claveNorm) || q.getExpedienteByClave.get(clave);

    const fechaEvento = ev.fechaCreacion
      ? new Date(ev.fechaCreacion).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);

    if (ev.tipo === "cedula") {
      // Cédula recibida → 5 días hábiles para contestar
      const vencimiento = calcularVencimiento(fechaEvento, 5, "habiles");
      q.insertTarea.run(
        exp?.id || null,
        `Contestar cédula — ${claveNorm}`,
        `Cédula recibida el ${fechaEvento}. Carátula: ${ev.payload?.caratulaExpediente || "—"}`,
        "pendiente", "alta",
        fechaEvento, vencimiento,
        5, "habiles", "auto_cedula", ev.id
      );
      console.log(`[TAREA AUTO] Cédula → contestar antes del ${vencimiento} — ${claveNorm}`);
    } else if (ev.tipo === "despacho") {
      // Despacho publicado → revisar en 3 días hábiles, puede requerir acción
      const vencimiento = calcularVencimiento(fechaEvento, 3, "habiles");
      q.insertTarea.run(
        exp?.id || null,
        `Revisar despacho — ${claveNorm}`,
        `Despacho publicado el ${fechaEvento}. Carátula: ${ev.payload?.caratulaExpediente || "—"}. Verificar si requiere acción procesal.`,
        "pendiente", "media",
        fechaEvento, vencimiento,
        3, "habiles", "auto_despacho", ev.id
      );
      console.log(`[TAREA AUTO] Despacho → revisar antes del ${vencimiento} — ${claveNorm}`);
    }
  } catch (err) {
    console.error("[TAREA AUTO] Error:", err.message);
  }
}

async function scrapeEventos(page, token) {
  console.log("[EVENTOS] Consultando API...");
  let totalNuevos = 0;
  let pageNum = 0;
  let hasMore = true;
  let fechaHasta = null;

  while (hasMore && pageNum < 20) {
    let url = `https://api.pjn.gov.ar/eventos/?page=${pageNum}&pageSize=20&categoria=judicial`;
    if (fechaHasta) url += `&fechaHasta=${fechaHasta}`;

    const response = await page.evaluate(
      async ({ url, token }) => {
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });
        return res.ok ? await res.json() : null;
      },
      { url, token }
    );

    if (!response?.items?.length) break;

    for (const ev of response.items) {
      const result = q.insertEvento.run(
        ev.id,
        ev.fechaCreacion,
        ev.fechaAccion,
        ev.tipo,
        ev.categoria,
        ev.link?.app || null,
        ev.link?.url || null,
        ev.hasDocument ? 1 : 0,
        ev.payload?.id || null,
        ev.payload?.caratulaExpediente || null,
        ev.payload?.claveExpediente || null,
        ev.payload?.tipoEvento || null,
        ev.payload?.fechaEnvio || null,
        ev.payload?.fechaFirma || null,
        ev.payload?.cuilDestinatario || null
      );
      if (result.changes > 0) {
        totalNuevos++;
        // Auto-crear tarea para eventos nuevos
        crearTareaAutomatica(ev);
      }
    }

    fechaHasta = response.items[0]?.fechaCreacion;
    pageNum++;
    if (response.items.length < 20) hasMore = false;
  }

  console.log(`[EVENTOS] ${totalNuevos} nuevos (${pageNum} páginas)`);
  return totalNuevos;
}

// ============================================================
// 2. EXPEDIENTES - Lista completa desde SCW autenticado
// Tabla: #tablaConsultaLista:tablaConsultaForm:j_idt179:dataTable
// Cols: Expediente | Dependencia | Carátula | Situación | Últ.Act.
// Paginación: a.padding-pagination dentro de .pagination
// ============================================================

async function scrapeExpedientes(page) {
  console.log("[EXPEDIENTES] Navegando a lista de expedientes...");

  await page.goto(
    "https://scw.pjn.gov.ar/scw/consultaListaRelacionados.seam",
    { waitUntil: "networkidle", timeout: 60000 }
  );
  await page.waitForTimeout(3000);

  // Desactivar filtro "solo en trámite" para ver TODOS
  const verTodos = page.locator("#verTodos a, #verTodos input, text=Ver todos");
  if (await verTodos.first().isVisible().catch(() => false)) {
    console.log("[EXPEDIENTES] Activando 'Ver todos los expedientes'...");
    await verTodos.first().click();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);
  }

  let totalActualizados = 0;
  let currentPage = 1;
  let hasMorePages = true;

  while (hasMorePages) {
    console.log(`[EXPEDIENTES] Página ${currentPage}...`);

    const rows = await page.evaluate(() => {
      // Tabla real: table-striped con headers Expediente/Dependencia/etc
      const tables = document.querySelectorAll("table");
      let targetTable = null;
      for (const t of tables) {
        const firstTh = t.querySelector("tr th, tr td");
        if (firstTh?.innerText?.includes("Expediente")) {
          targetTable = t;
          break;
        }
      }
      if (!targetTable) return [];

      const trs = targetTable.querySelectorAll("tbody tr");
      if (!trs.length) {
        // Sin tbody, saltar header
        const allTrs = targetTable.querySelectorAll("tr");
        return Array.from(allTrs).slice(1).map(tr => {
          const cells = tr.querySelectorAll("td");
          if (cells.length < 5) return null;
          return {
            clave: cells[0]?.innerText?.trim(),
            dependencia: cells[1]?.innerText?.trim(),
            caratula: cells[2]?.innerText?.trim(),
            situacion: cells[3]?.innerText?.trim(),
            ultimaActuacion: cells[4]?.innerText?.trim(),
          };
        }).filter(Boolean);
      }

      return Array.from(trs).map(tr => {
        const cells = tr.querySelectorAll("td");
        if (cells.length < 5) return null;
        return {
          clave: cells[0]?.innerText?.trim(),
          dependencia: cells[1]?.innerText?.trim(),
          caratula: cells[2]?.innerText?.trim(),
          situacion: cells[3]?.innerText?.trim(),
          ultimaActuacion: cells[4]?.innerText?.trim(),
        };
      }).filter(Boolean);
    });

    if (rows.length === 0 && currentPage === 1) {
      console.log("[EXPEDIENTES] No se encontraron filas. Probando selector alternativo...");
      await page.screenshot({ path: "debug-expedientes-vacio.png" });
    }

    for (const row of rows) {
      if (!row.clave) continue;
      // Limpiar y normalizar clave: quitar saltos de linea y ceros a la izquierda
      const claveRaw = row.clave.replace(/\n/g, " ").replace(/\s+/g, " ").trim();
      const clave = normalizarClave(claveRaw);
      const { codigo, numero, anio, sufijo } = parseClave(clave);

      // Detectar cambio de situación antes del upsert
      const expAnterior = q.getExpedienteByClave.get(clave);
      const situacionAnterior = expAnterior?.situacion;

      q.upsertExpediente.run(
        clave, codigo, numero, anio, sufijo,
        row.dependencia, row.caratula, row.situacion, row.ultimaActuacion
      );
      totalActualizados++;

      // Auto-tarea si cambió a EN DESPACHO o GIRO
      if (expAnterior && situacionAnterior !== row.situacion) {
        const hoy = new Date().toISOString().slice(0, 10);
        if (row.situacion === "EN DESPACHO" && situacionAnterior !== "EN DESPACHO") {
          const venc = calcularVencimiento(hoy, 5, "habiles");
          q.insertTarea.run(
            expAnterior.id, `Expediente EN DESPACHO — ${clave}`,
            `El expediente pasó de "${situacionAnterior}" a "EN DESPACHO". Revisar y tomar acción.`,
            "pendiente", "alta", hoy, venc, 5, "habiles", "auto_despacho", null
          );
          console.log(`[TAREA AUTO] ${clave} cambió a EN DESPACHO → tarea creada`);
        } else if (row.situacion === "GIRO" && situacionAnterior !== "GIRO") {
          q.insertTarea.run(
            expAnterior.id, `Expediente en GIRO — ${clave}`,
            `El expediente pasó de "${situacionAnterior}" a "GIRO". Seguimiento de giro.`,
            "pendiente", "media", hoy, null, null, "habiles", "auto_despacho", null
          );
          console.log(`[TAREA AUTO] ${clave} cambió a GIRO → tarea creada`);
        }
      }
    }

    // Paginación: click en link de siguiente página
    const nextPageLink = page.locator(
      `a.padding-pagination:has-text("${currentPage + 1}")`
    );
    if (await nextPageLink.isVisible().catch(() => false)) {
      await nextPageLink.click();
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(2000);
      currentPage++;
    } else {
      // Intentar botón de "siguiente" (>>)
      const nextBtn = page.locator(".last-page, a:has-text('>>')").first();
      if (currentPage < 10 && await nextBtn.isVisible().catch(() => false)) {
        await nextBtn.click();
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(2000);
        currentPage++;
      } else {
        hasMorePages = false;
      }
    }
  }

  console.log(`[EXPEDIENTES] ${totalActualizados} expedientes (${currentPage} páginas)`);
  return totalActualizados;
}

// ============================================================
// 3. ACTUACIONES - Detalle de expedientes con actividad reciente
// Para cada expediente que tuvo eventos recientes, entrar y
// scrapear sus actuaciones desde el SCW
// ============================================================

// Extrae y guarda las actuaciones (e intervinientes) de la vista de un
// expediente ya abierta (expediente.seam con #expediente:action-table).
// Devuelve la cantidad de actuaciones nuevas insertadas.
async function guardarActuacionesDeVista(page, exp) {
  // Click "Ver Todos" para ver todas las actuaciones
  const verTodos = page.locator('text="Ver Todos"').first();
  if (await verTodos.isVisible().catch(() => false)) {
    await verTodos.click();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
  }

  // Extraer actuaciones
  const actuaciones = await page.evaluate(() => {
    const rows = document.querySelectorAll("#expediente\\:action-table tr");
    const items = [];
    rows.forEach((tr, idx) => {
      if (idx === 0) return;
      const cells = tr.querySelectorAll("td");
      if (cells.length < 5) return;

      const linkDescarga = tr.querySelector('a[href*="viewer.seam"][href*="download=true"]');
      const linkVer = tr.querySelector('a[href*="viewer.seam"]:not([href*="download"])');

      items.push({
        oficina: cells[1]?.innerText?.replace("Oficina:", "").trim() || null,
        fecha: cells[2]?.innerText?.replace("Fecha:", "").trim() || null,
        tipo: cells[3]?.innerText?.replace("Tipo actuacion:", "").trim() || null,
        detalle: cells[4]?.innerText?.replace("Detalle:", "").trim() || null,
        fojas: cells[5]?.innerText?.trim() || null,
        urlDescarga: linkDescarga?.href || null,
        urlVer: linkVer?.href || null,
      });
    });
    return items;
  });

  // También extraer intervinientes si existe la tab
  const tabIntervinientes = page.locator('text="Intervinientes"').first();
  if (await tabIntervinientes.isVisible().catch(() => false)) {
    await tabIntervinientes.click();
    await page.waitForTimeout(2000);

    const partes = await page.evaluate(() => {
      const items = [];
      const rows = document.querySelectorAll("[id*='interviniente'] tr, [id*='Interviniente'] tr");
      rows.forEach(tr => {
        const cells = tr.querySelectorAll("td");
        if (cells.length >= 2) {
          items.push({
            tipo: cells[0]?.innerText?.trim(),
            nombre: cells[1]?.innerText?.trim(),
          });
        }
      });
      if (items.length === 0) {
        const panel = document.querySelector("[id*='interviniente'], [id*='Interviniente']");
        if (panel) {
          items.push({ tipo: "RAW", nombre: panel.innerText.trim().substring(0, 500) });
        }
      }
      return items;
    });

    if (partes.length > 0) {
      db.prepare("DELETE FROM partes WHERE expediente_id = ?").run(exp.id);
      for (const p of partes) {
        if (p.nombre) {
          q.insertParte.run(exp.id, p.tipo, p.nombre, null, null);
        }
      }
    }
  }

  // Guardar actuaciones
  let nuevasEsteExp = 0;
  for (const act of actuaciones) {
    const hash = hashActuacion(exp.id, act.fecha, act.tipo, act.oficina, act.detalle);
    const result = q.insertActuacion.run(
      exp.id, act.oficina, act.fecha, fechaToISO(act.fecha),
      act.tipo, act.detalle, act.fojas, act.urlDescarga, act.urlVer, hash
    );
    if (result.changes > 0) nuevasEsteExp++;
  }
  console.log(`[ACTUACIONES] ${exp.clave}: ${actuaciones.length} total, ${nuevasEsteExp} nuevas`);
  return nuevasEsteExp;
}

// --- Helpers de navegación de la lista paginada del SCW ---

async function irAListaCompleta(page) {
  await page.goto(
    "https://scw.pjn.gov.ar/scw/consultaListaRelacionados.seam",
    { waitUntil: "networkidle", timeout: 60000 }
  );
  await page.waitForTimeout(2500);
  const vt = page.locator("#verTodos a, #verTodos input, text=Ver todos");
  if (await vt.first().isVisible().catch(() => false)) {
    await vt.first().click();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2500);
  }
}

async function clickSiguientePagina(page, currentPage) {
  const nextLink = page.locator(`a.padding-pagination:has-text("${currentPage + 1}")`).first();
  if (await nextLink.isVisible().catch(() => false)) {
    await nextLink.click();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1500);
    return true;
  }
  const nextBtn = page.locator(".last-page, a:has-text('>>')").first();
  if (await nextBtn.isVisible().catch(() => false)) {
    await nextBtn.click();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1500);
    return true;
  }
  return false;
}

// Desde la página 1, avanzar hasta la página n. Devuelve true si llegó.
async function paginarHasta(page, n) {
  for (let p = 1; p < n; p++) {
    if (!(await clickSiguientePagina(page, p))) return false;
  }
  return true;
}

// Lee las claves de los expedientes de la página actual, en orden de fila.
async function leerClavesPagina(page) {
  return await page.evaluate(() => {
    const tables = document.querySelectorAll("table");
    let t = null;
    for (const tb of tables) {
      const h = tb.querySelector("tr th, tr td");
      if (h?.innerText?.includes("Expediente")) { t = tb; break; }
    }
    if (!t) return [];
    const trs = t.querySelectorAll("tbody tr");
    const rows = trs.length ? Array.from(trs) : Array.from(t.querySelectorAll("tr")).slice(1);
    return rows
      .map(tr => {
        const c = tr.querySelectorAll("td");
        return c.length >= 5 ? c[0].innerText.replace(/\s+/g, " ").trim() : null;
      })
      .filter(Boolean);
  });
}

// Recorre TODAS las páginas de la lista y scrapea las actuaciones de cada
// expediente clickeando su link "visualizar" (postback JSF, sin URL directa).
// Re-loguea por página para refrescar sesión y acotar memoria.
async function scrapeActuacionesCompleto() {
  console.log("[ACTUACIONES] Modo COMPLETO: recorriendo TODOS los expedientes...");
  let totalNuevas = 0;
  let procesados = 0;
  let pageNum = 1;
  const MAX_PAGINAS = 30;

  while (pageNum <= MAX_PAGINAS) {
    let browser;
    try {
      const auth = await loginYObtenerContexto();
      browser = auth.browser;
      const page = auth.page;

      await irAListaCompleta(page);
      if (!(await paginarHasta(page, pageNum))) {
        console.log(`[ACTUACIONES] No se pudo llegar a la página ${pageNum}, fin del recorrido`);
        break;
      }

      const claves = await leerClavesPagina(page);
      if (claves.length === 0) {
        console.log(`[ACTUACIONES] Página ${pageNum} sin filas, fin del recorrido`);
        break;
      }
      console.log(`[ACTUACIONES] Página ${pageNum}: ${claves.length} expedientes`);

      for (let i = 0; i < claves.length; i++) {
        const claveRaw = claves[i];
        const exp =
          q.getExpedienteByClave.get(normalizarClave(claveRaw)) ||
          q.getExpedienteByClave.get(claveRaw);
        if (!exp) continue;

        try {
          // Asegurar que la lista está renderizada en la página correcta
          let links = page.locator('a[title*="visualizar"], a:has-text("visualizar")');
          if ((await links.count()) <= i) {
            await irAListaCompleta(page);
            await paginarHasta(page, pageNum);
            links = page.locator('a[title*="visualizar"], a:has-text("visualizar")');
          }

          await links.nth(i).click();
          await page.waitForTimeout(3500);

          const actionTable = await page.$("#expediente\\:action-table, [id*='action-table']");
          if (actionTable) {
            totalNuevas += await guardarActuacionesDeVista(page, exp);
            procesados++;
          }

          // Volver a la lista para el siguiente; si falla, se re-navega arriba
          await page.goBack({ waitUntil: "networkidle" }).catch(() => {});
          await page.waitForTimeout(1500);
        } catch (err) {
          console.error(`[ACTUACIONES] Error ${claveRaw}:`, err.message);
          if (err.message.includes("closed") || err.message.includes("Target page")) break;
          await irAListaCompleta(page).catch(() => {});
          await paginarHasta(page, pageNum).catch(() => {});
        }
      }

      pageNum++;
    } catch (err) {
      console.error(`[ACTUACIONES COMPLETO] Error página ${pageNum}:`, err.message);
      pageNum++;
    } finally {
      if (browser) await browser.close().catch(() => {});
    }
  }

  console.log(`[ACTUACIONES] COMPLETO: ${procesados} expedientes, ${totalNuevas} actuaciones nuevas total`);
  return totalNuevas;
}

async function scrapeActuaciones(_ignoredPage, limit = 20) {
  // Scrapear actuaciones por prioridad (NO al azar, para no dejar afuera
  // expedientes con actividad reciente):
  //   1. eventos recientes (7 días)
  //   2. EN DESPACHO / GIRO
  //   3. rotación: los que no se actualizaron hace +14 días
  const expedientesConEventos = db.prepare(`
    SELECT id, clave, numero, anio, jurisdiccion_codigo, prioridad FROM (
      SELECT e.id, e.clave, e.numero, e.anio, e.jurisdiccion_codigo,
        CASE
          WHEN EXISTS (
            SELECT 1 FROM eventos ev
            WHERE (ev.clave_expediente = e.clave OR REPLACE(ev.clave_expediente,' 0',' ') = REPLACE(e.clave,' 0',' '))
              AND ev.fecha_creacion > (strftime('%s','now','-7 days') * 1000)
          ) THEN 0
          WHEN e.situacion IN ('EN DESPACHO', 'GIRO') THEN 1
          WHEN e.id NOT IN (SELECT DISTINCT expediente_id FROM actuaciones WHERE created_at > datetime('now', '-14 days')) THEN 2
          ELSE 99
        END AS prioridad
      FROM expedientes e
    )
    WHERE prioridad < 99
    ORDER BY prioridad ASC, RANDOM()
    LIMIT ?
  `).all(limit);

  if (expedientesConEventos.length === 0) {
    console.log("[ACTUACIONES] Sin expedientes con actividad reciente");
    return 0;
  }

  console.log(`[ACTUACIONES] Scrapeando ${expedientesConEventos.length} expedientes con actividad reciente...`);
  let totalNuevas = 0;

  // Process in batches of 5 with a fresh browser each batch to avoid OOM
  const BATCH_SIZE = 5;
  for (let batchStart = 0; batchStart < expedientesConEventos.length; batchStart += BATCH_SIZE) {
    const batch = expedientesConEventos.slice(batchStart, batchStart + BATCH_SIZE);
    let batchBrowser;
    try {
      const auth = await loginYObtenerContexto();
      batchBrowser = auth.browser;
      const page = auth.page;

      for (const exp of batch) {
        try {
          // Ir a la lista y buscar el expediente
          await page.goto(
            "https://scw.pjn.gov.ar/scw/consultaListaRelacionados.seam",
            { waitUntil: "networkidle", timeout: 30000 }
          );
          await page.waitForTimeout(2000);

          // Buscar el link del expediente en la tabla
          const expLink = page.locator(`td:has-text("${exp.clave}") ~ td a:has-text("visualizar")`).first();

          if (!await expLink.isVisible().catch(() => false)) {
            const evento = db.prepare(
              "SELECT link_url FROM eventos WHERE clave_expediente = ? ORDER BY fecha_creacion DESC LIMIT 1"
            ).get(exp.clave);

            if (evento?.link_url) {
              await page.goto(`https://scw.pjn.gov.ar/scw${evento.link_url}`, {
                waitUntil: "networkidle",
                timeout: 30000,
              });
              await page.waitForTimeout(3000);
            } else {
              continue;
            }
          } else {
            await expLink.click();
            await page.waitForLoadState("networkidle");
            await page.waitForTimeout(3000);
          }

          // Verificar que estamos en la vista de expediente
          const actionTable = await page.$("#expediente\\:action-table");
          if (!actionTable) {
            console.log(`[ACTUACIONES] ${exp.clave}: sin tabla de actuaciones`);
            continue;
          }

          totalNuevas += await guardarActuacionesDeVista(page, exp);

          await page.waitForTimeout(1500 + Math.random() * 1000);
        } catch (err) {
          console.error(`[ACTUACIONES] Error ${exp.clave}:`, err.message);
          // If browser died, break inner loop to start fresh batch
          if (err.message.includes('Target page') || err.message.includes('browser has been closed')) {
            console.log(`[ACTUACIONES] Browser crashed, restarting for next batch...`);
            break;
          }
        }
      }
    } catch (err) {
      console.error(`[ACTUACIONES] Batch login error:`, err.message);
    } finally {
      if (batchBrowser) await batchBrowser.close().catch(() => {});
    }
  }

  console.log(`[ACTUACIONES] ${totalNuevas} actuaciones nuevas total`);
  return totalNuevas;
}

// ============================================================
// 4. PDFs
// ============================================================

async function descargarPDFs(page, token, limit = 50) {
  console.log("[PDFS] Descargando pendientes...");

  const pendientes = db.prepare(
    "SELECT * FROM eventos WHERE has_document = 1 AND pdf_descargado = 0 ORDER BY fecha_creacion DESC LIMIT ?"
  ).all(limit);

  let descargados = 0;

  for (const ev of pendientes) {
    try {
      const pdfData = await page.evaluate(
        async ({ id, token }) => {
          const res = await fetch(`https://api.pjn.gov.ar/eventos/${id}/pdf`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!res.ok) return null;
          const buf = await res.arrayBuffer();
          return Array.from(new Uint8Array(buf));
        },
        { id: ev.id, token }
      );

      if (pdfData) {
        const safeClave = (ev.clave_expediente || "doc").replace(/[\s\/]/g, "_");
        const fileName = `${ev.tipo}-${ev.id}-${safeClave}.pdf`;
        const filePath = path.join(PDF_DIR, fileName);
        fs.writeFileSync(filePath, Buffer.from(pdfData));
        q.marcarPdfDescargado.run(filePath, ev.id);

        const exp = ev.clave_expediente
          ? q.getExpedienteByClave.get(ev.clave_expediente)
          : null;
        q.insertDocumento.run(
          ev.id, exp?.id || null, fileName,
          `https://api.pjn.gov.ar/eventos/${ev.id}/pdf`,
          filePath, pdfData.length
        );

        descargados++;
        console.log(`[PDFS] ${fileName} (${(pdfData.length / 1024).toFixed(1)}KB)`);
      }
    } catch (err) {
      console.error(`[PDFS] Error evento ${ev.id}:`, err.message);
    }
  }

  console.log(`[PDFS] ${descargados} descargados`);
  return descargados;
}

// ============================================================
// MAIN
// ============================================================

// Lock compartido: evita que el botón manual y el cron corran a la vez
let scrapeRunning = false;
function isScraping() { return scrapeRunning; }

async function scrapeAll(tipo = "MANUAL", opts = {}) {
  if (scrapeRunning) {
    console.log("[SCRAPE] Ya hay un scrape en curso — se omite esta corrida");
    return { skipped: true, eventosNuevos: 0, expedientesActualizados: 0, actuacionesNuevas: 0, pdfsDescargados: 0, errores: 0 };
  }
  scrapeRunning = true;
  const startTime = Date.now();
  let eventosNuevos = 0;
  let expedientesActualizados = 0;
  let actuacionesNuevas = 0;
  let pdfsDescargados = 0;
  let errores = 0;
  const detalles = [];

  try {
    // Phase 1: Eventos + Expedientes with one browser
    let token;
    {
      let browser;
      try {
        const auth = await loginYObtenerContexto();
        browser = auth.browser;
        token = auth.token;

        // 1. Eventos via API
        try {
          eventosNuevos = await scrapeEventos(auth.page, auth.token);
          detalles.push({ paso: "eventos", ok: true, nuevos: eventosNuevos });
        } catch (err) {
          errores++;
          detalles.push({ paso: "eventos", ok: false, error: err.message });
          console.error("[ERROR] Eventos:", err.message);
        }

        // 2. Lista completa de expedientes (212+)
        try {
          expedientesActualizados = await scrapeExpedientes(auth.page);
          detalles.push({ paso: "expedientes", ok: true, total: expedientesActualizados });
        } catch (err) {
          errores++;
          detalles.push({ paso: "expedientes", ok: false, error: err.message });
          console.error("[ERROR] Expedientes:", err.message);
        }
      } catch (err) {
        errores++;
        detalles.push({ paso: "login", ok: false, error: err.message });
        console.error("[ERROR] Login:", err.message);
      } finally {
        if (browser) await browser.close().catch(() => {});
      }
    }

    // Phase 2: Actuaciones - manages its own browsers in batches.
    // opts.full → recorre TODOS los expedientes (lento, 1x/día).
    // Si no, sync manual trae 80 por prioridad; el cron rota liviano (20).
    try {
      if (opts.full) {
        actuacionesNuevas = await scrapeActuacionesCompleto();
      } else {
        const limitActuaciones = tipo === "MANUAL" ? 80 : 20;
        actuacionesNuevas = await scrapeActuaciones(null, limitActuaciones);
      }
      detalles.push({ paso: "actuaciones", ok: true, nuevas: actuacionesNuevas });
    } catch (err) {
      errores++;
      detalles.push({ paso: "actuaciones", ok: false, error: err.message });
      console.error("[ERROR] Actuaciones:", err.message);
    }

    // Phase 3: PDFs with a fresh browser
    {
      let browser;
      try {
        const auth = await loginYObtenerContexto();
        browser = auth.browser;
        pdfsDescargados = await descargarPDFs(auth.page, auth.token);
        detalles.push({ paso: "pdfs", ok: true, descargados: pdfsDescargados });
      } catch (err) {
        errores++;
        detalles.push({ paso: "pdfs", ok: false, error: err.message });
        console.error("[ERROR] PDFs:", err.message);
      } finally {
        if (browser) await browser.close().catch(() => {});
      }
    }
  } catch (err) {
    errores++;
    detalles.push({ paso: "general", ok: false, error: err.message });
    console.error("[ERROR] General:", err.message);
  } finally {
    // Liberar el lock apenas terminan las fases (aunque falle el log)
    scrapeRunning = false;
  }

  const duracion = Date.now() - startTime;

  q.insertLog.run(
    tipo, eventosNuevos, expedientesActualizados,
    pdfsDescargados, errores, JSON.stringify(detalles), duracion
  );

  console.log(
    `[SCRAPE] ${duracion}ms | ${eventosNuevos} eventos | ${expedientesActualizados} expedientes | ${actuacionesNuevas} actuaciones | ${pdfsDescargados} PDFs | ${errores} errores`
  );

  return { eventosNuevos, expedientesActualizados, actuacionesNuevas, pdfsDescargados, errores, duracion, detalles };
}

if (require.main === module) {
  scrapeAll("MANUAL").then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
}

module.exports = { scrapeAll, getCredentials, isScraping, scrapeActuacionesCompleto };

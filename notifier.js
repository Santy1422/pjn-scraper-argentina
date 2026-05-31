const { db } = require("./db");

const ZAVU_API_URL = "https://api.zavu.dev";
const ZAVU_API_KEY = process.env.ZAVU_API_KEY;
const ZAVU_SENDER_ID = process.env.ZAVU_SENDER_ID;
const NOTIFY_PHONE = process.env.NOTIFY_PHONE || "541133251791";
const APP_URL = process.env.APP_URL || "https://pjn-scraper-argentina.up.railway.app";

async function sendWhatsApp(phone, message) {
  if (!ZAVU_API_KEY || !ZAVU_SENDER_ID) {
    console.log("[WHATSAPP] No configurado (faltan ZAVU_API_KEY o ZAVU_SENDER_ID)");
    return false;
  }

  try {
    const headers = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${ZAVU_API_KEY}`,
    };
    if (ZAVU_SENDER_ID) headers["Zavu-Sender"] = ZAVU_SENDER_ID;

    const res = await fetch(`${ZAVU_API_URL}/v1/messages`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        to: phone.startsWith("+") ? phone : `+${phone}`,
        text: message,
        channel: "whatsapp",
      }),
    });

    const data = await res.json();
    if (res.ok) {
      console.log(`[WHATSAPP] Mensaje enviado a ${phone}`);
      return true;
    } else {
      console.error("[WHATSAPP] Error:", res.status, data);
      return false;
    }
  } catch (err) {
    console.error("[WHATSAPP] Error:", err.message);
    return false;
  }
}

function buildSyncMessage(result) {
  const { eventosNuevos, expedientesActualizados, actuacionesNuevas, errores } = result;

  const hoy = new Date().toISOString().slice(0, 10);
  const movimientos = db.prepare(`
    SELECT a.tipo, a.detalle, a.fecha, e.clave, e.caratula
    FROM actuaciones a
    JOIN expedientes e ON a.expediente_id = e.id
    WHERE a.fecha_iso >= ?
    ORDER BY a.fecha_iso DESC
    LIMIT 10
  `).all(hoy);

  const alertas = db.prepare(`
    SELECT clave, situacion, caratula
    FROM expedientes
    WHERE situacion IN ('EN DESPACHO', 'GIRO')
    ORDER BY updated_at DESC
    LIMIT 5
  `).all();

  let msg = `📋 *PJN Scraper — Resumen diario*\n`;
  msg += `📅 ${hoy}\n\n`;

  msg += `📊 *Sincronización:*\n`;
  msg += `• ${eventosNuevos} eventos nuevos\n`;
  msg += `• ${expedientesActualizados} expedientes actualizados\n`;
  if (actuacionesNuevas > 0) msg += `• ${actuacionesNuevas} actuaciones nuevas\n`;
  if (errores > 0) msg += `⚠️ ${errores} errores\n`;
  msg += `\n`;

  if (movimientos.length > 0) {
    msg += `📌 *Movimientos de hoy:*\n`;
    for (const m of movimientos) {
      const det = m.detalle?.substring(0, 60) || m.tipo || '—';
      msg += `• *${m.clave}* — ${det}\n`;
    }
    msg += `\n`;
  }

  if (alertas.length > 0) {
    msg += `🚨 *Requieren atención:*\n`;
    for (const a of alertas) {
      msg += `• *${a.clave}* (${a.situacion})\n`;
    }
    msg += `\n`;
  }

  msg += `🔗 Ver todo: ${APP_URL}`;

  return msg;
}

async function notifyAfterSync(result) {
  if (!ZAVU_API_KEY) return;

  if (result.eventosNuevos === 0 && result.actuacionesNuevas === 0 && result.errores === 0) {
    console.log("[WHATSAPP] Sin novedades, no se envía notificación");
    return;
  }

  const message = buildSyncMessage(result);
  await sendWhatsApp(NOTIFY_PHONE, message);
}

module.exports = { notifyAfterSync, sendWhatsApp };

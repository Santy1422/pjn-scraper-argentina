const cron = require("node-cron");
const { scrapeAll } = require("./scraper");
const { notifyAfterSync } = require("./notifier");

// 8:00 — recorrido COMPLETO de todos los expedientes (lento, ~20-30 min)
cron.schedule(
  "0 8 * * 1-5",
  async () => {
    console.log(`[CRON] Scraping COMPLETO matutino - ${new Date().toISOString()}`);
    try {
      const result = await scrapeAll("CRON", { full: true });
      await notifyAfterSync(result);
    } catch (err) {
      console.error("[CRON ERROR]", err);
    }
  },
  { timezone: "America/Argentina/Buenos_Aires" }
);

// 10:00, 12:00 y 14:00 — scrape por prioridad (rápido)
cron.schedule(
  "0 10,12,14 * * 1-5",
  async () => {
    console.log(`[CRON] Scraping matutino (prioridad) - ${new Date().toISOString()}`);
    try {
      const result = await scrapeAll("CRON");
      await notifyAfterSync(result);
    } catch (err) {
      console.error("[CRON ERROR]", err);
    }
  },
  { timezone: "America/Argentina/Buenos_Aires" }
);

// Vespertino: 18:00
cron.schedule(
  "0 18 * * 1-5",
  () => {
    console.log(`[CRON] Scraping vespertino - ${new Date().toISOString()}`);
    scrapeAll("CRON").catch((err) => console.error("[CRON ERROR]", err));
  },
  { timezone: "America/Argentina/Buenos_Aires" }
);

console.log("[CRON] Programado: 8:00 (COMPLETO), 10/12/14 (prioridad) + WhatsApp, y 18:00 (scrape) — Lun-Vie, hora Argentina");

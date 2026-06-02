const cron = require("node-cron");
const { scrapeAll } = require("./scraper");
const { notifyAfterSync } = require("./notifier");

// Matutino: 8:00, 10:00, 12:00 y 14:00 (cada 2 hs, Lun-Vie, hora Argentina)
// scrape + WhatsApp (notifyAfterSync se omite solo si no hay novedades)
cron.schedule(
  "0 8,10,12,14 * * 1-5",
  async () => {
    console.log(`[CRON] Scraping matutino - ${new Date().toISOString()}`);
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

console.log("[CRON] Programado: 8:00, 10:00, 12:00, 14:00 (scrape + WhatsApp) y 18:00 (scrape) — Lun-Vie, hora Argentina");
